import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.config';
import { PrismaService } from '../prisma/prisma.service';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeWithDatabase('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    fullName: 'Auth E2E Test User',
    email: 'auth.e2e.test@example.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.refreshToken.deleteMany({
        where: { user: { email: { contains: 'e2e' } } },
      });
      await prisma.user.deleteMany({
        where: { email: { contains: 'e2e' } },
      });
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.refreshToken.deleteMany({
        where: { user: { email: testUser.email } },
      });
      await prisma.user.deleteMany({
        where: { email: testUser.email },
      });
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a user and returns expected shape without passwordHash', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        fullName: testUser.fullName,
        email: testUser.email,
        role: 'CUSTOMER',
      });
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('returns 409 Conflict on duplicate email registration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Duplicate User',
          email: testUser.email,
          password: testUser.password,
        })
        .expect(409);

      expect(response.body.message).toContain('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        });
    });

    it('successfully logs in with valid credentials and returns tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('returns 401 Unauthorized for wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('returns generic 401 Unauthorized for non-existent user without user enumeration', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent.user.e2e@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        });
      refreshToken = regRes.body.refreshToken;
    });

    it('returns new tokens pair for valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('rejects invalid or non-existent refresh token with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        });
      refreshToken = regRes.body.refreshToken;
    });

    it('logs out successfully with a valid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Attempting to use the revoked token afterwards should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('does not throw an error on an already-invalid or non-existent token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'already-invalid-token' })
        .expect(200);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          fullName: testUser.fullName,
          email: testUser.email,
          password: testUser.password,
        });
      accessToken = regRes.body.accessToken;
    });

    it('returns user profile when provided a valid access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        fullName: testUser.fullName,
        email: testUser.email,
        role: 'CUSTOMER',
      });
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('rejects request with no token with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('rejects request with invalid token with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);
    });
  });
});
