import { OrderStatus, PrismaClient, ProductStatus, Size } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PaymentService } from './payment.service';

const describeWithDatabase = process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase('Stripe payment flow with PostgreSQL', () => {
  const prisma = new PrismaClient();
  const ordersService = new OrdersService(prisma as any, { record: jest.fn().mockResolvedValue(undefined) } as any);
  const paymentService = new PaymentService(prisma as any, ordersService);
  const orderIds: string[] = [];
  let categoryId: string;
  let productId: string;
  let paidVariantId: string;
  let expiredVariantId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    await prisma.$connect();
    const suffix = Date.now();
    const category = await prisma.category.create({ data: { name: `Payments ${suffix}`, slug: `payments-${suffix}` } });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: { name: 'Payment test product', slug: `payment-product-${suffix}`, categoryId, price: 25, status: ProductStatus.ACTIVE },
    });
    productId = product.id;
    const variants = await Promise.all(['PAID', 'EXPIRED'].map((sku, index) => prisma.productVariant.create({
      data: { productId, sku: `PAYMENT-${sku}-${suffix}`, size: index === 0 ? Size.S : Size.M, price: 25, stock: 1 },
    })));
    paidVariantId = variants[0].id;
    expiredVariantId = variants[1].id;
  });

  afterAll(async () => {
    await prisma.processedStripeEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  function orderRequest(productVariantId: string) {
    return {
      customerName: 'Payment Test',
      customerEmail: 'payment-flow@example.com',
      items: [{ productVariantId, quantity: 1 }],
    };
  }

  it('reserves stock, creates a session, and marks the order paid once from a verified webhook', async () => {
    const order = await ordersService.create(orderRequest(paidVariantId));
    orderIds.push(order.id);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: paidVariantId } })).stock).toBe(0);

    (paymentService as any).stripe = {
      checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_paid', url: 'https://checkout.stripe.test/cs_paid' }) } },
      webhooks: { constructEvent: jest.fn().mockReturnValue({
        id: 'evt_paid',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_paid', payment_status: 'paid', metadata: { orderId: order.id, orderNumber: order.orderNumber } } },
      }) },
    };

    await expect(paymentService.createCheckoutSession(order.id, { guestAccessToken: order.guestAccessToken })).resolves.toMatchObject({ sessionId: 'cs_paid' });
    await expect(paymentService.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ status: OrderStatus.PAID });
    await expect(paymentService.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ message: 'Webhook already processed.' });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.PAID);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: paidVariantId } })).stock).toBe(0);
  });

  it('restores reserved stock once when Stripe expires a checkout session', async () => {
    const order = await ordersService.create(orderRequest(expiredVariantId));
    orderIds.push(order.id);
    (paymentService as any).stripe = {
      checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_expired', url: 'https://checkout.stripe.test/cs_expired' }) } },
      webhooks: { constructEvent: jest.fn().mockReturnValue({
        id: 'evt_expired',
        type: 'checkout.session.expired',
        data: { object: { id: 'cs_expired', metadata: { orderId: order.id, orderNumber: order.orderNumber } } },
      }) },
    };

    await paymentService.createCheckoutSession(order.id, { guestAccessToken: order.guestAccessToken });
    await expect(paymentService.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    await expect(paymentService.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ message: 'Webhook already processed.' });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.CANCELLED);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: expiredVariantId } })).stock).toBe(1);
  });
});
