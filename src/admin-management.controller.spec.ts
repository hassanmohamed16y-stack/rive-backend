import { ProductStatus, OrderStatus } from '@prisma/client';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminOrdersController } from './orders/admin-orders.controller';

describe('Admin management controllers', () => {
  it('lists all product statuses only through the admin controller path', async () => {
    const productsService = { findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }) };
    const controller = new AdminProductsController(productsService as any);

    await controller.findAll(ProductStatus.DRAFT, { page: 1, limit: 20 });
    expect(productsService.findAll).toHaveBeenCalledWith(
      { status: ProductStatus.DRAFT }, { page: 1, limit: 20 }, true,
    );
  });

  it('delegates admin order status changes to the centralized state machine', async () => {
    const ordersService = { transitionStatus: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.SHIPPED }) };
    const controller = new AdminOrdersController(ordersService as any);

    await expect(controller.updateStatus('order-1', { status: OrderStatus.SHIPPED })).resolves.toMatchObject({ status: OrderStatus.SHIPPED });
    expect(ordersService.transitionStatus).toHaveBeenCalledWith('order-1', OrderStatus.SHIPPED);
  });
});
