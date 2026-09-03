import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
      productVariant: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productImage: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
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

  it('updates a product variant directly and records an audit log', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      stock: 5,
      price: 280,
      isAvailable: true,
      colorHex: '#945958',
      size: 'S',
    });
    prisma.productVariant.update.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      stock: 9,
      price: 300,
      isAvailable: false,
      colorHex: '#000000',
      size: 'M',
    });

    await expect(
      service.updateVariant(
        'product-1',
        'variant-1',
        { stock: 9, price: 300, isAvailable: false, colorHex: '#000000', size: 'M' } as any,
        'admin-1',
      ),
    ).resolves.toMatchObject({ id: 'variant-1', stock: 9, price: 300, isAvailable: false });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: { stock: 9, price: 300, isAvailable: false, colorHex: '#000000', size: 'M' },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      action: 'product-variant.update',
      entityType: 'ProductVariant',
      entityId: 'variant-1',
    }));
  });

  it('rejects deleting a product variant that has order history', async () => {
    const { service, prisma } = createService();
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1', productId: 'product-1' });
    prisma.productVariant.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.removeVariant('product-1', 'variant-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects negative stock values before updating a product variant', async () => {
    const { service, prisma } = createService();

    await expect(service.updateVariant('product-1', 'variant-1', { stock: -1 }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productVariant.findFirst).not.toHaveBeenCalled();
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
  });
});
