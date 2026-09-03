import { PrismaClient, ProductStatus, Size } from '@prisma/client';
import { ProductsService } from './products.service';

const describeWithDatabase = process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase('ProductsService PostgreSQL variant stock concurrency', () => {
  const prisma = new PrismaClient();
  const service = new ProductsService(prisma as any, { record: jest.fn().mockResolvedValue(undefined) } as any);
  let variantId: string;
  let productId: string;
  let categoryId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now();
    const category = await prisma.category.create({ data: { name: `Variant concurrency ${suffix}`, slug: `variant-concurrency-${suffix}` } });
    categoryId = category.id;
    const product = await prisma.product.create({ data: { name: 'Variant concurrency product', slug: `variant-concurrency-product-${suffix}`, categoryId, price: 10, status: ProductStatus.ACTIVE } });
    productId = product.id;
    const variant = await prisma.productVariant.create({ data: { productId, sku: `VARIANT-CONCURRENCY-${suffix}`, size: Size.S, price: 10, stock: 1 } });
    variantId = variant.id;
  });

  afterAll(async () => {
    await prisma.productVariant.delete({ where: { id: variantId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it('allows exactly one simultaneous decrement when one unit exists', async () => {
    const results = await Promise.allSettled([
      service.adjustVariantStock(productId, variantId, -1, 'concurrency test'),
      service.adjustVariantStock(productId, variantId, -1, 'concurrency test'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).resolves.toMatchObject({ stock: 0 });
  });
});
