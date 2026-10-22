import { ExecutionContext, ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { sign } from "jsonwebtoken";
import { MaintenanceGuard } from "./maintenance.guard";
import { SettingsService } from "./settings.service";

describe("MaintenanceGuard", () => {
  let guard: MaintenanceGuard;
  let settingsService: { getMaintenanceMode: jest.Mock };

  beforeEach(async () => {
    settingsService = {
      getMaintenanceMode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceGuard,
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    guard = module.get<MaintenanceGuard>(MaintenanceGuard);
  });

  function createMockContext(url: string, authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          originalUrl: url,
          url,
          headers: authorization ? { authorization } : {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it("allows admin routes when maintenance mode is active", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });

    const context = createMockContext("/api/v1/admin/maintenance-mode");
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(settingsService.getMaintenanceMode).not.toHaveBeenCalled();
  });

  it("allows internal cron routes when maintenance mode is active", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });

    const context = createMockContext("/api/v1/internal/expire-reservations");
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(settingsService.getMaintenanceMode).not.toHaveBeenCalled();
  });

  it("allows health check routes when maintenance mode is active", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });

    const context = createMockContext("/api/v1/health");
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
  });

  it("allows public store routes when maintenance mode is inactive", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: false });

    const context = createMockContext("/api/v1/products");
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(settingsService.getMaintenanceMode).toHaveBeenCalled();
  });

  it("throws 503 ServiceUnavailableException on public store routes when maintenance mode is active", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });

    const context = createMockContext("/api/v1/products");

    await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
  });

  describe("staff bypass", () => {
    const secret = process.env.JWT_SECRET ?? "development-only-secret";
    const token = (claims: Record<string, unknown>, key = secret) =>
      sign(claims, key, { algorithm: "HS256" });

    beforeEach(() => {
      settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });
    });

    it("lets a signed-in admin use storefront-level routes during maintenance", async () => {
      const ctx = createMockContext("/api/v1/categories", `Bearer ${token({ role: "ADMIN" })}`);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it("still blocks customers", async () => {
      const ctx = createMockContext("/api/v1/categories", `Bearer ${token({ role: "CUSTOMER" })}`);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ServiceUnavailableException);
    });

    it("blocks forged tokens and non-access tokens", async () => {
      const forged = createMockContext("/api/v1/categories", `Bearer ${token({ role: "ADMIN" }, "wrong-secret")}`);
      await expect(guard.canActivate(forged)).rejects.toThrow(ServiceUnavailableException);
      const twoFa = createMockContext("/api/v1/categories", `Bearer ${token({ role: "ADMIN", purpose: "2fa" })}`);
      await expect(guard.canActivate(twoFa)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
