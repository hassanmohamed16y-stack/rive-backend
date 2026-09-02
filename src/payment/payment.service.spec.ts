import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PaymentService } from './payment.service';

const pendingOrder = {
  id: 'order-1',
  orderNumber: 'RIV-1000-ABC',
  userId: 'user-1',
  guestAccessToken: null,
  status: OrderStatus.PENDING,
  reservationExpiresAt: new Date(Date.now() + 60_000),
  paymentSessionId: null,
  items: [{
    quantity: 1,
    unitPrice: '120.00',
    productVariant: { size: 'S', product: { name: 'Luna Silk Set' } },
  }],
};

function createService(overrides: Record<string, unknown> = {}) {
  const transactionClient = {
    processedStripeEvent: { create: jest.fn().mockResolvedValue({ id: 'event-record-1' }) },
    order: { findUnique: jest.fn().mockResolvedValue({ paymentSessionId: 'cs_123' }) },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(pendingOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((callback) => callback(transactionClient)),
    ...overrides,
  };
  const ordersService = {
    expireOrder: jest.fn().mockResolvedValue(false),
    markPaidInTransaction: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.PAID }),
    cancelPendingOrderInTransaction: jest.fn().mockResolvedValue(true),
  };
  const service = new PaymentService(prisma as any, ordersService as any);
  return { service, prisma, transactionClient, ordersService };
}

function verifiedEvent(type: string, paymentStatus = 'paid') {
  return {
    id: 'evt_123',
    type,
    data: { object: { id: 'cs_123', metadata: { orderId: 'order-1', orderNumber: 'RIV-1000-ABC' }, payment_status: paymentStatus } },
  };
}

describe('PaymentService Stripe Checkout and webhook security', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('creates a Checkout Session with server prices, metadata, and a stable idempotency key', async () => {
    const { service, prisma } = createService();
    const create = jest.fn().mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.test/cs_123' });
    (service as any).stripe = { checkout: { sessions: { create } } };

    await expect(service.createCheckoutSession('order-1', { userId: 'user-1', role: 'CUSTOMER' }))
      .resolves.toMatchObject({ sessionId: 'cs_123' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { orderId: 'order-1', orderNumber: 'RIV-1000-ABC' },
      payment_intent_data: { metadata: { orderId: 'order-1', orderNumber: 'RIV-1000-ABC' } },
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 12000 }) })],
    }), { idempotencyKey: 'checkout-session:order-1' });
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ paymentSessionId: null }),
    }));
  });

  it('reuses an open Checkout Session instead of creating another one', async () => {
    const { service } = createService({
      order: { findUnique: jest.fn().mockResolvedValue({ ...pendingOrder, paymentSessionId: 'cs_existing' }) },
    });
    const retrieve = jest.fn().mockResolvedValue({ id: 'cs_existing', status: 'open', url: 'https://checkout.stripe.test/existing' });
    const create = jest.fn();
    (service as any).stripe = { checkout: { sessions: { retrieve, create } } };

    await expect(service.createCheckoutSession('order-1', { userId: 'user-1', role: 'CUSTOMER' }))
      .resolves.toMatchObject({ sessionId: 'cs_existing' });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the same idempotent session when a concurrent request stores it first', async () => {
    const { service, prisma } = createService();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    prisma.order.findUnique
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ paymentSessionId: 'cs_123' });
    (service as any).stripe = {
      checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.test/cs_123' }) } },
    };

    await expect(service.createCheckoutSession('order-1', { userId: 'user-1', role: 'CUSTOMER' }))
      .resolves.toMatchObject({ sessionId: 'cs_123', message: 'Checkout session already exists.' });
  });

  it('rejects an invalid order and an invalid webhook signature', async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(service.createCheckoutSession('missing', { userId: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);

    (service as any).stripe = { webhooks: { constructEvent: jest.fn(() => { throw new Error('invalid'); }) } };
    await expect(service.handleWebhook(Buffer.from('{}'), 'invalid')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a webhook signed by the Stripe SDK test-signature generator', async () => {
    const { service, ordersService } = createService();
    const event = verifiedEvent('checkout.session.completed');
    const payload = JSON.stringify(event);
    const signature = (service as any).stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_test',
    });

    await expect(service.handleWebhook(Buffer.from(payload), signature)).resolves.toMatchObject({ status: OrderStatus.PAID });
    expect(ordersService.markPaidInTransaction).toHaveBeenCalledTimes(1);
  });

  it('marks only a verified paid checkout event as paid', async () => {
    const { service, transactionClient, ordersService } = createService();
    (service as any).stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue(verifiedEvent('checkout.session.completed')) } };

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ status: OrderStatus.PAID });
    expect(transactionClient.processedStripeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stripeEventId: 'evt_123', orderId: 'order-1' }),
    }));
    expect(ordersService.markPaidInTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not mark an unpaid checkout completion as paid', async () => {
    const { service, ordersService } = createService();
    (service as any).stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue(verifiedEvent('checkout.session.completed', 'unpaid')) } };

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ message: 'Checkout session is not paid.' });
    expect(ordersService.markPaidInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a verified event whose Checkout Session is not stored on the order', async () => {
    const { service, transactionClient, ordersService } = createService();
    transactionClient.order.findUnique.mockResolvedValue({ paymentSessionId: 'cs_other' });
    (service as any).stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue(verifiedEvent('checkout.session.completed')) } };

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).rejects.toThrow('does not match');
    expect(ordersService.markPaidInTransaction).not.toHaveBeenCalled();
  });

  it.each(['checkout.session.async_payment_failed', 'checkout.session.expired'])('releases a pending reservation for %s', async (type) => {
    const { service, ordersService } = createService();
    (service as any).stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue(verifiedEvent(type)) } };

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    expect(ordersService.cancelPendingOrderInTransaction).toHaveBeenCalledTimes(1);
  });

  it('acknowledges duplicate and concurrent duplicate deliveries without a second transition', async () => {
    const { service, transactionClient, ordersService } = createService();
    let eventAlreadyInserted = false;
    transactionClient.processedStripeEvent.create.mockImplementation(async () => {
      if (eventAlreadyInserted) throw { code: 'P2002' };
      eventAlreadyInserted = true;
      return { id: 'event-record-1' };
    });
    (service as any).stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue(verifiedEvent('checkout.session.completed')) } };

    const results = await Promise.all([service.handleWebhook(Buffer.from('{}'), 'valid'), service.handleWebhook(Buffer.from('{}'), 'valid')]);
    expect(results.filter((result) => result.message === 'Webhook already processed.')).toHaveLength(1);
    expect(ordersService.markPaidInTransaction).toHaveBeenCalledTimes(1);
  });
});
