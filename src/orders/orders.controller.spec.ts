import { ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersController } from './orders.controller';

describe('OrdersController ownership checks', () => {
  it('rejects cancellation of an order that does not belong to the requesting user or guest', async () => {
    const ordersService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'RIV-1000-ABC',
        userId: 'owner-1',
        guestAccessToken: 'guest-token',
        status: OrderStatus.PENDING,
      }),
      cancelByOrderNumber: jest.fn(),
    };
    const controller = new OrdersController(ordersService as any);

    await expect(controller.cancel('RIV-1000-ABC', { user: { userId: 'other-user', role: 'CUSTOMER' }, headers: {} }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(ordersService.cancelByOrderNumber).not.toHaveBeenCalled();
  });
});
