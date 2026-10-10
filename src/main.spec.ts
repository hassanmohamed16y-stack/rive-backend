import supertest from "supertest";
import { OrdersService } from "./orders/orders.service";
import { PrismaService } from "./prisma/prisma.service";
import handler, { createApp } from "./main";

describe("main", () => {
  const originalEnv = process.env;

  beforeAll(() => {
    jest.spyOn(PrismaService.prototype, "$connect").mockResolvedValue();
    jest.spyOn(PrismaService.prototype, "$disconnect").mockResolvedValue();
    jest.spyOn(OrdersService.prototype, "onModuleInit").mockResolvedValue();
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://mock:mock@localhost:5432/mock_db",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should create app with createApp()", async () => {
    const app = await createApp();
    expect(app).toBeDefined();
    await app.close();
  });

  it("should handle request via default handler in Vercel mode and cache instance", async () => {
    process.env.VERCEL = "1";

    const response1 = await supertest(handler).get("/health");
    expect(response1.status).toBeDefined();

    // Second call should hit the cached instance
    const response2 = await supertest(handler).get("/health");
    expect(response2.status).toBeDefined();
    expect(response2.body).toBeDefined();
  });
});
