import { ProductStatus, OrderStatus } from '@prisma/client';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminOrdersController } from './orders/admin-orders.controller';

describe('Admin management controllers', () => {
  it('lists all product statuses only through the admin controller path', async () => {
    const productsService = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByIdForAdmin: jest.fn().mockResolvedValue({ id: 'product-1', status: ProductStatus.DRAFT }),
      createVariant: jest.fn().mockResolvedValue({ id: 'variant-1' }),
      updateVariant: jest.fn().mockResolvedValue({ id: 'variant-1', stock: 8 }),
      removeVariant: jest.fn().mockResolvedValue({ id: 'variant-1' }),
      createImage: jest.fn().mockResolvedValue({ id: 'image-1' }),
      removeImage: jest.fn().mockResolvedValue({ id: 'image-1' }),
    };
    const controller = new AdminProductsController(productsService as any);

    await controller.findAll(ProductStatus.DRAFT, { page: 1, limit: 20 });
    await expect(controller.findOne('product-1')).resolves.toMatchObject({ id: 'product-1', status: ProductStatus.DRAFT });
    await expect(controller.createVariant('product-1', { sku: 'SKU-1' } as any, { user: { id: 'admin-1' } })).resolves.toMatchObject({ id: 'variant-1' });
    await expect(controller.updateVariant('product-1', 'variant-1', { stock: 8 }, { user: { id: 'admin-1' } })).resolves.toMatchObject({ id: 'variant-1', stock: 8 });
    await expect(controller.removeVariant('product-1', 'variant-1', { user: { id: 'admin-1' } })).resolves.toMatchObject({ id: 'variant-1' });
    await expect(controller.createImage('product-1', { url: 'https://example.com/image.png' } as any, { user: { id: 'admin-1' } })).resolves.toMatchObject({ id: 'image-1' });
    await expect(controller.removeImage('product-1', 'image-1', { user: { id: 'admin-1' } })).resolves.toMatchObject({ id: 'image-1' });
    expect(productsService.findAll).toHaveBeenCalledWith(
      { status: ProductStatus.DRAFT }, { page: 1, limit: 20 }, true,
    );
    expect(productsService.findByIdForAdmin).toHaveBeenCalledWith('product-1');
    expect(productsService.createVariant).toHaveBeenCalledWith('product-1', { sku: 'SKU-1' }, 'admin-1');
    expect(productsService.updateVariant).toHaveBeenCalledWith('product-1', 'variant-1', { stock: 8 }, 'admin-1');
    expect(productsService.removeVariant).toHaveBeenCalledWith('product-1', 'variant-1', 'admin-1');
    expect(productsService.createImage).toHaveBeenCalledWith('product-1', { url: 'https://example.com/image.png' }, 'admin-1');
    expect(productsService.removeImage).toHaveBeenCalledWith('product-1', 'image-1', 'admin-1');
  });

  it('delegates admin order detail and status changes to the centralized state machine', async () => {
    const ordersService = {
      findByIdForAdmin: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.PENDING }),
      transitionStatus: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.SHIPPED }),
    };
    const controller = new AdminOrdersController(ordersService as any);

    await expect(controller.findOne('order-1')).resolves.toMatchObject({ status: OrderStatus.PENDING });
    await expect(controller.updateStatus('order-1', { status: OrderStatus.SHIPPED }, { user: { id: 'admin-1' } })).resolves.toMatchObject({ status: OrderStatus.SHIPPED });
    expect(ordersService.findByIdForAdmin).toHaveBeenCalledWith('order-1');
    expect(ordersService.transitionStatus).toHaveBeenCalledWith('order-1', OrderStatus.SHIPPED, 'admin-1');
  });
});
