import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when the database is reachable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as any);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('returns a sanitized service-unavailable response when the database is down', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')) };
    const controller = new HealthController(prisma as any);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
