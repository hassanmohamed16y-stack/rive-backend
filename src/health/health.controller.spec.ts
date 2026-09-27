import { Test, TestingModule } from "@nestjs/testing";
import { v2 as cloudinary } from "cloudinary";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { AlertService } from "./alert.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let alertService: { sendAlert: jest.Mock };

  const originalEnv = process.env;
  let pingSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;

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

    pingSpy = jest.spyOn(cloudinary.api, "ping").mockResolvedValue({ status: "ok" });

    fetchSpy = jest.spyOn(global, "fetch").mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes("paymob.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: "test-paymob-auth-token" }),
        } as Response);
      }
      if (urlStr.includes("neon.tech")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ branches: [{ updated_at: "2026-09-27T12:00:00Z" }] }),
        } as Response);
      }
      return Promise.reject(new Error("Unknown endpoint"));
    });

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
    jest.restoreAllMocks();
  });

  it("returns status 'healthy' for all services when database, Cloudinary, and Paymob are reachable", async () => {
    const res = await controller.check();

    expect(res.status).toBe("healthy");
    expect(res.services.database.status).toBe("healthy");
    expect(res.services.database.name).toBe("Database");
    expect(res.services.cloudinary.status).toBe("healthy");
    expect(res.services.cloudinary.name).toBe("Cloudinary");
    expect(res.services.paymob.status).toBe("healthy");
    expect(res.services.paymob.name).toBe("Paymob");
    expect(res.backup.status).toBe("automated_pitr_active");
    expect(res.timestamp).toBeDefined();
  });

  it("returns 'unhealthy' for database when $queryRaw fails and triggers alert", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("DB Connection Lost"));

    const res = await controller.check();

    expect(res.status).toBe("unhealthy");
    expect(res.services.database.status).toBe("unhealthy");
    expect(res.services.database.message).toContain("DB Connection Lost");
    expect(alertService.sendAlert).toHaveBeenCalledWith(
      "DATABASE_FAILURE",
      "Database Health Check Failure",
      expect.stringContaining("DB Connection Lost"),
    );
  });

  it("returns 'unhealthy' status for Cloudinary when env vars are missing", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;

    const res = await controller.check();

    expect(res.status).toBe("unhealthy");
    expect(res.services.cloudinary.status).toBe("unhealthy");
    expect(res.services.cloudinary.message).toContain("missing or incomplete");
  });

  it("returns 'unhealthy' status for Cloudinary when ping API call throws error", async () => {
    pingSpy.mockRejectedValue({ error: { message: "unknown api_key" } });

    const res = await controller.check();

    expect(res.status).toBe("unhealthy");
    expect(res.services.cloudinary.status).toBe("unhealthy");
    expect(res.services.cloudinary.message).toContain("unknown api_key");
  });

  it("returns 'unhealthy' status for Paymob when env vars are missing", async () => {
    delete process.env.PAYMOB_API_KEY;

    const res = await controller.check();

    expect(res.status).toBe("unhealthy");
    expect(res.services.paymob.status).toBe("unhealthy");
    expect(res.services.paymob.message).toContain("missing or incomplete");
  });

  it("returns 'unhealthy' status for Paymob when API call returns non-200 authentication error", async () => {
    fetchSpy.mockImplementation((url) => {
      if (String(url).includes("paymob.com")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: () => Promise.resolve({ detail: "incorrect credentials" }),
        } as Response);
      }
      return Promise.reject(new Error("Unknown endpoint"));
    });

    const res = await controller.check();

    expect(res.status).toBe("unhealthy");
    expect(res.services.paymob.status).toBe("unhealthy");
    expect(res.services.paymob.message).toContain("incorrect credentials");
  });

  it("fetches backup info from Neon API when NEON_API_KEY and NEON_PROJECT_ID are configured", async () => {
    process.env.NEON_API_KEY = "test-neon-key";
    process.env.NEON_PROJECT_ID = "test-neon-project";

    const res = await controller.checkBackupEndpoint();

    expect(res.status).toBe("configured");
    expect(res.lastBackupAt).toBe("2026-09-27T12:00:00Z");
    expect(res.provider).toBe("Neon PostgreSQL");
    expect(res.pitrEnabled).toBe(true);
  });

  it("returns fallback automated_pitr_active backup instructions when NEON API keys are not provided", async () => {
    delete process.env.NEON_API_KEY;
    delete process.env.NEON_PROJECT_ID;

    const res = await controller.checkBackupEndpoint();

    expect(res.status).toBe("automated_pitr_active");
    expect(res.lastBackupAt).toBeNull();
    expect(res.manualVerification.dashboardUrl).toBe("https://console.neon.tech");
    expect(res.manualVerification.steps.length).toBeGreaterThan(0);
  });
});
