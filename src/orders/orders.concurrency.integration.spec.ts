import { PrismaClient, ProductStatus, Size } from '@prisma/client';
import { OrdersService } from './orders.service';

const describeWithDatabase = process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase('OrdersService PostgreSQL concurrency', () => {
  const prisma = new PrismaClient();
  const service = new OrdersService(prisma as any);
  let variantId: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.create({
      data: { name: `Concurrency ${Date.now()}`, slug: `concurrency-${Date.now()}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: 'Concurrency test product',
        slug: `concurrency-product-${Date.now()}`,
        categoryId,
        price: 10,
        status: ProductStatus.ACTIVE,
      },
    });
    productId = product.id;
    const variant = await prisma.productVariant.create({
      data: { productId, sku: `CONCURRENCY-${Date.now()}`, size: Size.S, price: 10, stock: 1 },
    });
    variantId = variant.id;
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { productVariantId: variantId } } },
      select: { id: true },
    });
    await prisma.orderItem.deleteMany({ where: { productVariantId: variantId } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
    await prisma.productVariant.delete({ where: { id: variantId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it('allows exactly one simultaneous reservation when only one unit exists', async () => {
    const order = {
      customerName: 'Test Customer',
      customerEmail: 'concurrency@example.com',
      items: [{ productVariantId: variantId, quantity: 1 }],
    };

    const results = await Promise.allSettled([service.create(order), service.create(order)]);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const orders = await prisma.order.findMany({ where: { items: { some: { productVariantId: variantId } } } });

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(variant.stock).toBe(0);
    expect(orders).toHaveLength(1);
  });
});
