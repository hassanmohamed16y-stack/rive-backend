import { ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  function createService() {
    const prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'category-1', isFeatured: true, _count: { products: 0 } }]),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new CategoriesService(prisma as any, auditLogService as any), prisma };
  }

  it('returns categories with pagination metadata', async () => {
    const { service, prisma } = createService();

    await expect(service.findAll(undefined, { page: 2, limit: 10 })).resolves.toEqual({
      data: [{ id: 'category-1', isFeatured: true, _count: { products: 0 } }],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: {} }));
  });

  it('filters featured categories using the same query-string pattern as products', async () => {
    const { service, prisma } = createService();

    await service.findAll({ isFeatured: 'true' }, { page: 1, limit: 20 });

    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isFeatured: true } }));
    expect(prisma.category.count).toHaveBeenCalledWith({ where: { isFeatured: true } });
  });

  it('maps a category foreign-key restriction to a safe conflict response', async () => {
    const { service, prisma } = createService();
    prisma.category.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.remove('category-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
