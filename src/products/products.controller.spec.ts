import { Reflector } from '@nestjs/core';
import { ProductsController } from './products.controller';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('ProductsController', () => {
  it('lists products and delegates filters/pagination to the service', async () => {
    const productsService = {
      findAll: jest.fn().mockResolvedValue({ data: [{ id: 'product-1' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    };
    const controller = new ProductsController(productsService as any);

    await controller.findAll({ category: 'bags', isFeatured: true, search: 'tote', page: 1, limit: 20 } as any);

    expect(productsService.findAll).toHaveBeenCalledWith(
      { category: 'bags', isFeatured: true, search: 'tote' },
      { page: 1, limit: 20 },
    );
  });

  it('returns a single active product by slug', async () => {
    const productsService = { findOneBySlug: jest.fn().mockResolvedValue({ id: 'product-1', slug: 'tote-bag' }) };
    const controller = new ProductsController(productsService as any);

    await expect(controller.findOne('tote-bag')).resolves.toMatchObject({ slug: 'tote-bag' });
    expect(productsService.findOneBySlug).toHaveBeenCalledWith('tote-bag');
  });

  it('propagates a NotFoundException from the service for an unknown slug', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const productsService = { findOneBySlug: jest.fn().mockRejectedValue(new NotFoundException('Product not found')) };
    const controller = new ProductsController(productsService as any);

    await expect(controller.findOne('missing-slug')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates create/update/archive (admin) to the service with the acting admin user id', async () => {
    const productsService = {
      create: jest.fn().mockResolvedValue({ id: 'product-2' }),
      update: jest.fn().mockResolvedValue({ id: 'product-1', name: 'Updated' }),
      archive: jest.fn().mockResolvedValue({ id: 'product-1', status: 'ARCHIVED' }),
    };
    const controller = new ProductsController(productsService as any);
    const req = { user: { id: 'admin-1' } } as any;

    await expect(controller.create({ name: 'Bag' } as any, req)).resolves.toMatchObject({ id: 'product-2' });
    await expect(controller.update('product-1', { name: 'Updated' } as any, req)).resolves.toMatchObject({ name: 'Updated' });
    await expect(controller.archive('product-1', req)).resolves.toMatchObject({ status: 'ARCHIVED' });
    expect(productsService.create).toHaveBeenCalledWith({ name: 'Bag' }, 'admin-1');
    expect(productsService.update).toHaveBeenCalledWith('product-1', { name: 'Updated' }, 'admin-1');
    expect(productsService.archive).toHaveBeenCalledWith('product-1', 'admin-1');
  });

  it('requires the ADMIN role (guarded route metadata) for create/update/archive but not for the public list/detail endpoints', () => {
    const reflector = new Reflector();

    expect(reflector.get(ROLES_KEY, ProductsController.prototype.create)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, ProductsController.prototype.update)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, ProductsController.prototype.archive)).toEqual(['ADMIN']);
    expect(reflector.get(ROLES_KEY, ProductsController.prototype.findAll)).toBeUndefined();
    expect(reflector.get(ROLES_KEY, ProductsController.prototype.findOne)).toBeUndefined();
  });
});
