import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.config';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeWithDatabase('Auth Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('enforces rate limiting on POST /api/v1/auth/login after limit is exceeded', async () => {
    const loginPayload = {
      email: 'rate.limit.test@example.com',
      password: 'SomePassword123!',
    };

    // The login route is decorated with @Throttle({ default: { limit: 5, ttl: 60000 } })
    // We send 5 requests (which fail with 401 Unauthorized), then the 6th request should fail with 429 Too Many Requests.
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginPayload)
        .expect(401);
    }

    const throttledResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(loginPayload)
      .expect(429);

    expect(throttledResponse.body.message).toMatch(/ThrottlerException|Too Many Requests/i);
  });
});
