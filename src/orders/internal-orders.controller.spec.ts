import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InternalOrdersController } from './internal-orders.controller';

describe('InternalOrdersController', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ordersService = { expirePendingReservations: jest.fn() };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  function createController() {
    return new InternalOrdersController(ordersService as any);
  }

  it('rejects when INTERNAL_CRON_SECRET is not configured', async () => {
    delete process.env.INTERNAL_CRON_SECRET;
    const controller = createController();

    await expect(controller.expireReservations('anything')).rejects.toBeInstanceOf(ForbiddenException);
    expect(ordersService.expirePendingReservations).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect secret using a timing-safe comparison', async () => {
    process.env.INTERNAL_CRON_SECRET = 'a-secure-internal-cron-secret-32-chars-min';
    const controller = createController();

    await expect(controller.expireReservations(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.expireReservations('wrong-secret')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ordersService.expirePendingReservations).not.toHaveBeenCalled();
  });

  it('expires reservations when the secret matches', async () => {
    process.env.INTERNAL_CRON_SECRET = 'a-secure-internal-cron-secret-32-chars-min';
    ordersService.expirePendingReservations.mockResolvedValue(3);
    const controller = createController();

    const result = await controller.expireReservations('a-secure-internal-cron-secret-32-chars-min');

    expect(result).toEqual({ expiredCount: 3 });
    expect(ordersService.expirePendingReservations).toHaveBeenCalledTimes(1);
  });
});
