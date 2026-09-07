import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeWithDatabase('AuthController e2e flows', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  const testUser = {
    email: `auth-e2e-${Date.now()}@example.com`,
    password: 'Password123!',
    fullName: 'Test User',
  };

  const createdUserEmails: string[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long!!';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    authService = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    if (prisma && createdUserEmails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: createdUserEmails } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user successfully and returns user without passwordHash', async () => {
      createdUserEmails.push(testUser.email);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.fullName).toBe(testUser.fullName);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 409 Conflict when registering with a duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toMatch(/already exists|duplicate/i);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in successfully with valid credentials and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 401 Unauthorized for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('returns generic 401 Unauthorized for non-existent user without user enumeration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@example.com`,
          password: testUser.password,
        })
        .expect(401);

      expect(res.body.error).toMatch(/Invalid credentials/i);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const res = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });
      refreshToken = res.refreshToken;
    });

    it('returns a new token pair given a valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('rejects an invalid or fake refresh token with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token-uuid-12345' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const res = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });
      refreshToken = res.refreshToken;
    });

    it('logs out successfully with a valid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Verify token cannot be reused
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('does not throw on an already-invalid/revoked token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'already-invalid-token-123' })
        .expect(200);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const res = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = res.accessToken;
    });

    it('returns user profile with valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('rejects request with missing token with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('rejects request with invalid access token with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);
    });
  });
});
