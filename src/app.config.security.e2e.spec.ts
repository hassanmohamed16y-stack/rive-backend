import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from './app.config';

describe('configureApp security gates (Swagger docs & CORS)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  async function buildApp() {
    const moduleRef = await Test.createTestingModule({}).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    return app;
  }

  describe('when NODE_ENV is not development/test (e.g. production)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.NODE_ENV = 'production';
      app = await buildApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 404 for /api/docs', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(404);
    });

    it('rejects requests from http://localhost:3000 via CORS', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('when NODE_ENV is development', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.NODE_ENV = 'development';
      app = await buildApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('serves /api/docs', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(200);
    });

    it('allows requests from http://localhost:3000 via CORS', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });
});
