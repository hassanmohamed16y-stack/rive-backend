import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InternalOrdersController } from './internal-orders.controller';
import { OrdersService } from './orders.service';

describe('InternalOrdersController', () => {
  let app: INestApplication;
  const originalInternalCronSecret = process.env.INTERNAL_CRON_SECRET;
  const ordersService = {
    expirePendingReservations: jest.fn().mockResolvedValue(3),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalOrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    process.env.INTERNAL_CRON_SECRET = 'cron-secret';
    ordersService.expirePendingReservations.mockClear();
  });

  afterAll(async () => {
    process.env.INTERNAL_CRON_SECRET = originalInternalCronSecret;
    await app.close();
  });

  it('rejects requests without the cron secret header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/expire-reservations')
      .expect(403);

    expect(ordersService.expirePendingReservations).not.toHaveBeenCalled();
  });

  it('rejects requests with the wrong cron secret header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/expire-reservations')
      .set('x-internal-cron-secret', 'wrong-secret')
      .expect(403);

    expect(ordersService.expirePendingReservations).not.toHaveBeenCalled();
  });

  it('calls the service and returns the expired count when the cron secret is correct', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/expire-reservations')
      .set('x-internal-cron-secret', 'cron-secret')
      .expect(200)
      .expect({ expiredCount: 3 });

    expect(ordersService.expirePendingReservations).toHaveBeenCalledTimes(1);
  });
});
