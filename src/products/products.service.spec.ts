import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
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

describe('ProductsService variant and image administration', () => {
  function createService() {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'product-1' }),
      },
      productVariant: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      productImage: {
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new ProductsService(prisma as any, auditLogService as any), prisma, auditLogService };
  }

  it('adds a variant and records an audit log entry', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.productVariant.create.mockResolvedValue({ id: 'variant-1', sku: 'SKU-1' });

    const dto = { sku: 'SKU-1', size: 'S', price: 100, stock: 5 } as any;
    await expect(service.addVariant('product-1', dto, 'admin-1')).resolves.toMatchObject({ id: 'variant-1' });

    expect(prisma.productVariant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'product-1', sku: 'SKU-1', stock: 5 }),
    }));
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.variant.create' }));
  });

  it('throws NotFoundException when adding a variant to a missing product', async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.addVariant('missing', { sku: 'SKU-1', size: 'S', price: 100 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets an absolute stock value (not a decrement) when updating a variant', async () => {
    const { service, prisma, auditLogService } = createService();
    const now = new Date('2026-01-01T00:00:00.000Z');
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1', productId: 'product-1', updatedAt: now });
    prisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
    prisma.productVariant.findUniqueOrThrow.mockResolvedValue({ id: 'variant-1', stock: 42 });

    const dto = { stock: 42, expectedUpdatedAt: now.toISOString() } as any;
    await expect(service.updateVariant('product-1', 'variant-1', dto, 'admin-1')).resolves.toMatchObject({ stock: 42 });

    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant-1', productId: 'product-1', updatedAt: now },
      data: { stock: 42 },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.variant.update' }));
  });

  it('rejects a concurrent update with ConflictException when updatedAt no longer matches', async () => {
    const { service, prisma } = createService();
    const now = new Date('2026-01-01T00:00:00.000Z');
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1', productId: 'product-1', updatedAt: now });
    prisma.productVariant.updateMany.mockResolvedValue({ count: 0 });

    const dto = { stock: 42, expectedUpdatedAt: now.toISOString() } as any;
    await expect(service.updateVariant('product-1', 'variant-1', dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when updating a variant that does not belong to the product', async () => {
    const { service, prisma } = createService();
    prisma.productVariant.findFirst.mockResolvedValue(null);

    const dto = { stock: 1, expectedUpdatedAt: new Date().toISOString() } as any;
    await expect(service.updateVariant('product-1', 'variant-1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents deleting a variant that has existing order items', async () => {
    const { service, prisma } = createService();
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1', productId: 'product-1' });
    prisma.productVariant.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.removeVariant('product-1', 'variant-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes a variant with no order history and records an audit log entry', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1', productId: 'product-1' });
    prisma.productVariant.delete.mockResolvedValue({ id: 'variant-1' });

    await expect(service.removeVariant('product-1', 'variant-1', 'admin-1')).resolves.toEqual({ success: true });
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.variant.delete' }));
  });

  it('adds a product image and records an audit log entry', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.productImage.create.mockResolvedValue({ id: 'image-1', url: 'https://example.com/1.png' });

    const dto = { url: 'https://example.com/1.png' } as any;
    await expect(service.addImage('product-1', dto, 'admin-1')).resolves.toMatchObject({ id: 'image-1' });
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.image.create' }));
  });

  it('removes a product image and records an audit log entry', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.productImage.findFirst.mockResolvedValue({ id: 'image-1', productId: 'product-1' });
    prisma.productImage.delete.mockResolvedValue({ id: 'image-1' });

    await expect(service.removeImage('product-1', 'image-1', 'admin-1')).resolves.toEqual({ success: true });
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.image.delete' }));
  });

  it('throws NotFoundException when removing an image that does not belong to the product', async () => {
    const { service, prisma } = createService();
    prisma.productImage.findFirst.mockResolvedValue(null);

    await expect(service.removeImage('product-1', 'missing-image')).rejects.toBeInstanceOf(NotFoundException);
  });
});
