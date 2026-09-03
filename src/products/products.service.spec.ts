import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';

describe('ProductsService public visibility and pagination', () => {
  function createService() {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'active-product', status: ProductStatus.ACTIVE }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new ProductsService(prisma as any, auditLogService as any), prisma, auditLogService };
  }

  it('limits public lists to ACTIVE products and returns pagination metadata', async () => {
    const { service, prisma } = createService();

    await expect(service.findAll(undefined, { page: 2, limit: 10 })).resolves.toEqual({
      data: [{ id: 'active-product', status: ProductStatus.ACTIVE }],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ProductStatus.ACTIVE }, skip: 10, take: 10,
    }));
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { status: ProductStatus.ACTIVE } });
  });

  describe('ProductsService variant management', () => {
    const existingVariant = { id: 'variant-1', productId: 'product-1', stock: 2, sku: 'SKU-1' };

    function createService() {
      const prisma = {
        product: { findUnique: jest.fn().mockResolvedValue({ id: 'product-1' }) },
        productVariant: {
          create: jest.fn().mockResolvedValue(existingVariant),
          findFirst: jest.fn().mockResolvedValue(existingVariant),
          update: jest.fn().mockResolvedValue({ ...existingVariant, isAvailable: false }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...existingVariant, stock: 1 }),
          delete: jest.fn().mockResolvedValue(existingVariant),
        },
      };
      const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
      return { service: new ProductsService(prisma as any, auditLogService as any), prisma, auditLogService };
    }

    it('uses a conditional atomic decrement and records before and after values', async () => {
      const { service, prisma, auditLogService } = createService();
      await expect(service.adjustVariantStock('product-1', 'variant-1', -1, 'recount', 'admin-1')).resolves.toMatchObject({ stock: 1 });
      expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: 'variant-1', productId: 'product-1', stock: { gte: 1 } }, data: { stock: { increment: -1 } } });
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'variant.stock-adjust', changes: expect.objectContaining({ before: existingVariant, adjustment: -1, reason: 'recount' }) }));
    });

    it('rejects a decrement when the conditional stock update does not match', async () => {
      const { service, prisma } = createService();
      prisma.productVariant.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.adjustVariantStock('product-1', 'variant-1', -3, 'recount')).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects deletion when an order item references the variant', async () => {
      const { service, prisma } = createService();
      prisma.productVariant.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: 'test' }));
      await expect(service.removeVariant('product-1', 'variant-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('does not expose a DRAFT product through the public slug lookup', async () => {
    const { service, prisma } = createService();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOneBySlug('draft-product')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: 'draft-product', status: ProductStatus.ACTIVE },
    }));
  });

  it('allows the protected admin path to list and retrieve all statuses', async () => {
    const { service, prisma } = createService();
    prisma.product.findFirst.mockResolvedValue({ id: 'draft-product', status: ProductStatus.DRAFT });
    prisma.product.findUnique.mockResolvedValue({ id: 'draft-product', status: ProductStatus.DRAFT, images: [], variants: [] });

    await service.findAll({ status: ProductStatus.DRAFT }, { page: 1, limit: 20 }, true);
    await expect(service.findOneBySlug('draft-product', true)).resolves.toMatchObject({ status: ProductStatus.DRAFT });
    await expect(service.findByIdForAdmin('draft-product')).resolves.toMatchObject({ status: ProductStatus.DRAFT });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ProductStatus.DRAFT },
    }));
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'draft-product' } }));
    expect(prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'draft-product' } }));
  });
});
