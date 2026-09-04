import { ProductStatus, OrderStatus } from '@prisma/client';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminOrdersController } from './orders/admin-orders.controller';

describe('Admin management controllers', () => {
  it('lists all product statuses only through the admin controller path', async () => {
    const productsService = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByIdForAdmin: jest.fn().mockResolvedValue({ id: 'product-1', status: ProductStatus.DRAFT }),
    };
    const controller = new AdminProductsController(productsService as any);

    await controller.findAll(ProductStatus.DRAFT, { page: 1, limit: 20 });
    await expect(controller.findOne('product-1')).resolves.toMatchObject({ id: 'product-1', status: ProductStatus.DRAFT });
    expect(productsService.findAll).toHaveBeenCalledWith(
      { status: ProductStatus.DRAFT }, { page: 1, limit: 20 }, true,
    );
    expect(productsService.findByIdForAdmin).toHaveBeenCalledWith('product-1');
  });

  it('delegates admin order detail and status changes to the centralized state machine', async () => {
    const ordersService = {
      findByIdForAdmin: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.PENDING }),
      transitionStatus: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.SHIPPED }),
    };
    const controller = new AdminOrdersController(ordersService as any);

    await expect(controller.findOne('order-1')).resolves.toMatchObject({ status: OrderStatus.PENDING });
    await expect(controller.updateStatus('order-1', { status: OrderStatus.SHIPPED }, { user: { id: 'admin-1' } } as any)).resolves.toMatchObject({ status: OrderStatus.SHIPPED });
    expect(ordersService.findByIdForAdmin).toHaveBeenCalledWith('order-1');
    expect(ordersService.transitionStatus).toHaveBeenCalledWith('order-1', OrderStatus.SHIPPED, 'admin-1');
  });
});
