import { NotFoundException } from '@nestjs/common';
import { OrdersController } from './orders.controller';

describe('OrdersController ownership checks', () => {
  it('propagates the NotFoundException OrdersService.findOne throws for a non-owned order', async () => {
    // Ownership enforcement lives in OrdersService.findOne (shared isOrderOwnedByActor
    // helper), so a mismatched actor rejects with NotFoundException - not a resolved
    // order for the controller to reject separately - keeping "not owned" and "does
    // not exist" indistinguishable to the caller.
    const ordersService = {
      findOne: jest.fn().mockRejectedValue(new NotFoundException('Order RIV-1000-ABC was not found')),
      cancelByOrderNumber: jest.fn(),
    };
    const controller = new OrdersController(ordersService as any);

    await expect(controller.cancel('RIV-1000-ABC', { user: { userId: 'other-user', role: 'CUSTOMER' }, headers: {} } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.findOne).toHaveBeenCalledWith('RIV-1000-ABC', {
      userId: 'other-user',
      role: 'CUSTOMER',
      guestAccessToken: undefined,
    });
    expect(ordersService.cancelByOrderNumber).not.toHaveBeenCalled();
  });
});
