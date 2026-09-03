import { ForbiddenException } from '@nestjs/common';
import { InternalOrdersController } from './internal-orders.controller';

describe('InternalOrdersController', () => {
  const ordersService = { expirePendingReservations: jest.fn().mockResolvedValue(2) };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_CRON_SECRET = 'cron-secret';
  });

  it('expires reservations when called with the configured secret', async () => {
    await expect(new InternalOrdersController(ordersService as any).expireReservations('cron-secret')).resolves.toEqual({ expiredCount: 2 });
  });

  it('rejects requests without the configured secret', async () => {
    await expect(new InternalOrdersController(ordersService as any).expireReservations('wrong')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
