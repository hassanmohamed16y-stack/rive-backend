import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';

describe('ProductsService public visibility and pagination', () => {
  function createService() {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'active-product', status: ProductStatus.ACTIVE }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
      },
    };
    return { service: new ProductsService(prisma as any), prisma };
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

    await service.findAll({ status: ProductStatus.DRAFT }, { page: 1, limit: 20 }, true);
    await expect(service.findOneBySlug('draft-product', true)).resolves.toMatchObject({ status: ProductStatus.DRAFT });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ProductStatus.DRAFT },
    }));
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'draft-product' } }));
  });
});
