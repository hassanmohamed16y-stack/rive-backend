import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { configureApp } from "../app.config";

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "true" &&
  process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeWithDatabase("Auth Rate Limiting e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long!!";
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

  it("enforces rate limiting on POST /api/v1/auth/login and returns HTTP 429 when limit is exceeded", async () => {
    const loginPayload = {
      email: "rate-limit-test@example.com",
      password: "SomePassword123!",
    };

    // Limit on login is 5 requests per 60s
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send(loginPayload);

      expect(response.status).not.toBe(429);
    }

    // 6th request exceeds limit and must return HTTP 429
    const rateLimitedResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send(loginPayload);

    expect(rateLimitedResponse.status).toBe(429);
    const errorMessage =
      rateLimitedResponse.body.error ?? rateLimitedResponse.body.message;
    expect(errorMessage).toMatch(/ThrottlerException|Too Many Requests/i);
  });
});
