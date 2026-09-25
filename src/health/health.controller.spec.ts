import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { AlertService } from "./alert.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let alertService: { sendAlert: jest.Mock };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: "test-cloud",
      CLOUDINARY_API_KEY: "test-key",
      CLOUDINARY_API_SECRET: "test-secret",
      PAYMOB_API_KEY: "test-paymob-key",
      PAYMOB_HMAC_SECRET: "test-hmac-secret",
      PAYMOB_INTEGRATION_ID_CARD: "123456",
    };

    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };

    alertService = {
      sendAlert: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AlertService, useValue: alertService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns status 'ok' for all services when everything is configured and reachable", async () => {
    const res = await controller.check();

    expect(res.status).toBe("ok");
    expect(res.services.database).toEqual({ status: "ok" });
    expect(res.services.cloudinary).toEqual({ status: "ok" });
    expect(res.services.paymob).toEqual({ status: "ok" });
    expect(res.timestamp).toBeDefined();
  });

  it("returns error status for database when $queryRaw fails and triggers alert", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("DB Connection Lost"));

    const res = await controller.check();

    expect(res.status).toBe("error");
    expect(res.services.database.status).toBe("error");
    expect(res.services.database.message).toBe("DB Connection Lost");
    expect(alertService.sendAlert).toHaveBeenCalledWith(
      "DATABASE_FAILURE",
      "Database Health Check Failure",
      expect.stringContaining("DB Connection Lost"),
    );
  });

  it("returns error status for Cloudinary when env vars are missing", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;

    const res = await controller.check();

    expect(res.status).toBe("error");
    expect(res.services.cloudinary.status).toBe("error");
    expect(res.services.cloudinary.message).toBeDefined();
  });

  it("returns error status for Paymob when env vars are missing", async () => {
    delete process.env.PAYMOB_API_KEY;

    const res = await controller.check();

    expect(res.status).toBe("error");
    expect(res.services.paymob.status).toBe("error");
    expect(res.services.paymob.message).toBeDefined();
  });
});
