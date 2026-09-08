process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long!!";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_123456789";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { AppModule } from "../app.module";
import { configureApp } from "../app.config";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole } from "@prisma/client";

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "true" &&
  process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeWithDatabase("Comprehensive Automated Security Tests (E2E against real NestJS server & real database)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  let regularUser1: { email: string; password: string; id: string; accessToken: string };
  let regularUser2: { email: string; password: string; id: string; accessToken: string };
  let adminUser: { email: string; password: string; id: string; accessToken: string };
  let user2OrderNumber: string;

  const testPassword = "Password123!";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    authService = moduleRef.get(AuthService);

    const timestamp = Date.now();
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create regular User 1
    const u1Email = `sec-user1-${timestamp}@example.com`;
    const u1Db = await prisma.user.create({
      data: {
        email: u1Email,
        fullName: "Security User 1",
        passwordHash: hashedPassword,
        role: UserRole.CUSTOMER,
      },
    });
    const u1Login = await authService.login({ email: u1Email, password: testPassword });
    regularUser1 = { email: u1Email, password: testPassword, id: u1Db.id, accessToken: u1Login.accessToken };

    // Create regular User 2
    const u2Email = `sec-user2-${timestamp}@example.com`;
    const u2Db = await prisma.user.create({
      data: {
        email: u2Email,
        fullName: "Security User 2",
        passwordHash: hashedPassword,
        role: UserRole.CUSTOMER,
      },
    });
    const u2Login = await authService.login({ email: u2Email, password: testPassword });
    regularUser2 = { email: u2Email, password: testPassword, id: u2Db.id, accessToken: u2Login.accessToken };

    // Create Admin User
    const adminEmail = `sec-admin-${timestamp}@example.com`;
    const adminDb = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: "Security Admin User",
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
      },
    });
    const adminLogin = await authService.login({ email: adminEmail, password: testPassword });
    adminUser = { email: adminEmail, password: testPassword, id: adminDb.id, accessToken: adminLogin.accessToken };

    // Create an order owned by User 2
    user2OrderNumber = `RIV-SEC-${timestamp}`;
    await prisma.order.create({
      data: {
        orderNumber: user2OrderNumber,
        userId: regularUser2.id,
        status: "PENDING",
        totalAmount: 250,
        customerName: "Security User 2",
        customerEmail: regularUser2.email,
        notes: "Private Order for User 2",
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const createdEmails = [regularUser1?.email, regularUser2?.email, adminUser?.email].filter(Boolean);
      if (createdEmails.length > 0) {
        const users = await prisma.user.findMany({
          where: { email: { in: createdEmails } },
          select: { id: true },
        });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
          await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe("1. ACCESS CONTROL / IDOR", () => {
    it("returns 404/403 when regular user attempts to access another user's order by guessing ID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${user2OrderNumber}`)
        .set("Authorization", `Bearer ${regularUser1.accessToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it("returns 404/403 when regular user attempts to cancel another user's order", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${user2OrderNumber}/cancel`)
        .set("Authorization", `Bearer ${regularUser1.accessToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it("returns 403 when regular user attempts to access admin-only orders list endpoint", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/orders")
        .set("Authorization", `Bearer ${regularUser1.accessToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 when regular user attempts to modify order status via admin endpoint", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/orders/some-order-id/status`)
        .set("Authorization", `Bearer ${regularUser1.accessToken}`)
        .send({ status: "SHIPPED" });

      expect(res.status).toBe(403);
    });

    it("returns 403 when regular user attempts to access admin-only product management endpoint", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/products")
        .set("Authorization", `Bearer ${regularUser1.accessToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 when regular user attempts to add variant via admin product endpoint", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/products/product-1/variants")
        .set("Authorization", `Bearer ${regularUser1.accessToken}`)
        .send({ sku: "TEST-SKU", size: "S", price: 100, colorHex: "#000000" });

      expect(res.status).toBe(403);
    });
  });

  describe("2. RATE LIMITING / BRUTE FORCE", () => {
    it("throttles rapid failed login attempts with HTTP 429", async () => {
      let rateLimited = false;
      let lastStatus = 401;

      for (let i = 0; i < 25; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({
            email: regularUser1.email,
            password: "WrongPasswordAttempt!",
          });

        lastStatus = res.status;
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }

      expect(rateLimited).toBe(true);
      expect(lastStatus).toBe(429);
    });
  });

  describe("3. JWT / TOKEN TAMPERING", () => {
    it("returns 401 when access token payload/signature is modified by 1 character", async () => {
      const token = regularUser1.accessToken;
      const modifiedToken = token.slice(0, -1) + (token.slice(-1) === "a" ? "b" : "a");

      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${modifiedToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 401 when an expired access token is used", async () => {
      const expiredToken = jwt.sign(
        {
          sub: regularUser1.id,
          userId: regularUser1.id,
          email: regularUser1.email,
          role: "CUSTOMER",
          exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
        },
        process.env.JWT_SECRET!,
      );

      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("rejects token with forged/altered role claim (forged signature or DB role verification)", async () => {
      // 1. Forged token signed with wrong secret containing ADMIN role
      const forgedAdminToken = jwt.sign(
        {
          sub: regularUser1.id,
          userId: regularUser1.id,
          email: regularUser1.email,
          role: "ADMIN",
        },
        "wrong-secret-key-forged-signature-123456",
      );

      const resForged = await request(app.getHttpServer())
        .get("/api/v1/admin/orders")
        .set("Authorization", `Bearer ${forgedAdminToken}`);

      expect(resForged.status).toBe(401);

      // 2. Even if a user claims role: "ADMIN" in a validly signed token, JwtStrategy re-verifies user from DB
      // and enforces their actual DB role ("CUSTOMER"), causing admin endpoints to return 403.
      const userTokenWithAdminClaim = jwt.sign(
        {
          sub: regularUser1.id,
          userId: regularUser1.id,
          email: regularUser1.email,
          role: "ADMIN",
        },
        process.env.JWT_SECRET!,
      );

      const resDBCheck = await request(app.getHttpServer())
        .get("/api/v1/admin/orders")
        .set("Authorization", `Bearer ${userTokenWithAdminClaim}`);

      expect(resDBCheck.status).toBe(403);
    });
  });

  describe("4. INJECTION (SQL / NoSQL / XSS)", () => {
    it("handles SQL injection strings safely through Prisma without crashing or leaking SQL errors", async () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT null, null, null--",
      ];

      for (const payload of sqlPayloads) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/products?search=${encodeURIComponent(payload)}`);

        expect([200, 400]).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toMatch(/syntax error|pg_query|PrismaClientKnownRequestError/i);
      }
    });

    it("stores and returns XSS payloads safely without executing raw script HTML", async () => {
      const xssPayload = "<script>alert(1)</script>";

      const res = await request(app.getHttpServer())
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${regularUser1.accessToken}`)
        .send({
          customerName: "Security Test User",
          customerEmail: regularUser1.email,
          notes: xssPayload,
          items: [],
        });

      // Validated by DTO or processed
      if (res.status === 201) {
        expect(res.headers["content-type"]).toMatch(/application\/json/);
        expect(res.body.notes).toBe(xssPayload);
      } else {
        expect(res.status).toBe(400);
      }
    });
  });

  describe("5. FILE UPLOAD VALIDATION (Cloudinary)", () => {
    it("rejects non-image file uploads (e.g. .exe / .php / invalid magic bytes) with 400", async () => {
      const fakeExecutableBuffer = Buffer.from("MZ header executable code...");

      const res = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${adminUser.accessToken}`)
        .attach("file", fakeExecutableBuffer, "malicious.php.png");

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Only JPEG, PNG, and WEBP|magic bytes/i);
    });
  });

  describe("6. STRIPE WEBHOOK SIGNATURE VERIFICATION", () => {
    it("rejects POST requests to Stripe webhook without a valid stripe-signature header with 400/401", async () => {
      const payload = JSON.stringify({
        id: "evt_fake_123",
        type: "checkout.session.completed",
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it("rejects POST requests to Stripe webhook with an invalid signature header with 400", async () => {
      const payload = JSON.stringify({
        id: "evt_fake_456",
        type: "checkout.session.completed",
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "t=123456,v1=invalid_signature_hash")
        .set("Content-Type", "application/json")
        .send(payload);

      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });
  });
});
