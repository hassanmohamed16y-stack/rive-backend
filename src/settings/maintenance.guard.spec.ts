import { ExecutionContext, ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
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

  function createMockContext(url: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: url, url }),
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
});
