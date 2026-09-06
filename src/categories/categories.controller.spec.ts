import { Reflector } from '@nestjs/core';
import { CategoriesController } from './categories.controller';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('CategoriesController', () => {
  it('lists categories with product counts and delegates filters/pagination to the service', async () => {
    const categoriesService = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: 'cat-1', name: 'Bags', _count: { products: 3 } }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };
    const controller = new CategoriesController(categoriesService as any);

    const result = await controller.findAll({ isFeatured: true, page: 1, limit: 20 } as any);

    expect(categoriesService.findAll).toHaveBeenCalledWith({ isFeatured: true }, { page: 1, limit: 20 });
    expect(result.data[0]).toMatchObject({ id: 'cat-1', productCount: 3 });
  });

  it('delegates category creation to the service with the acting admin user id', async () => {
    const categoriesService = { create: jest.fn().mockResolvedValue({ id: 'cat-2' }) };
    const controller = new CategoriesController(categoriesService as any);

    await expect(controller.create({ name: 'Shoes' } as any, { user: { id: 'admin-1' } } as any))
      .resolves.toMatchObject({ id: 'cat-2' });
    expect(categoriesService.create).toHaveBeenCalledWith({ name: 'Shoes' }, 'admin-1');
  });

  it('delegates category update and removal to the service', async () => {
    const categoriesService = {
      update: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Updated' }),
      remove: jest.fn().mockResolvedValue({ id: 'cat-1' }),
    };
    const controller = new CategoriesController(categoriesService as any);

    await expect(controller.update('cat-1', { name: 'Updated' } as any, { user: { id: 'admin-1' } } as any))
      .resolves.toMatchObject({ name: 'Updated' });
    await expect(controller.remove('cat-1', { user: { id: 'admin-1' } } as any)).resolves.toMatchObject({ id: 'cat-1' });
    expect(categoriesService.update).toHaveBeenCalledWith('cat-1', { name: 'Updated' }, 'admin-1');
    expect(categoriesService.remove).toHaveBeenCalledWith('cat-1', 'admin-1');
  });

  it('requires the ADMIN role (guarded route metadata) for create/update/remove but not for the public list endpoint', () => {
    const reflector = new Reflector();

    expect(reflector.get(ROLES_KEY, CategoriesController.prototype.create)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, CategoriesController.prototype.update)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, CategoriesController.prototype.remove)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, CategoriesController.prototype.findAll)).toBeUndefined();
  });
});
