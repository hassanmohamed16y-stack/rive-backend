import { Test, TestingModule } from "@nestjs/testing";
import { AdminSettingsController } from "./admin-settings.controller";
import { SettingsService } from "./settings.service";

describe("AdminSettingsController", () => {
  let controller: AdminSettingsController;
  let settingsService: {
    getMaintenanceMode: jest.Mock;
    setMaintenanceMode: jest.Mock;
    getEnforce2FA: jest.Mock;
    setEnforce2FA: jest.Mock;
  };

  beforeEach(async () => {
    settingsService = {
      getMaintenanceMode: jest.fn(),
      setMaintenanceMode: jest.fn(),
      getEnforce2FA: jest.fn(),
      setEnforce2FA: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSettingsController],
      providers: [{ provide: SettingsService, useValue: settingsService }],
    }).compile();

    controller = module.get<AdminSettingsController>(AdminSettingsController);
  });

  it("gets maintenance mode", async () => {
    settingsService.getMaintenanceMode.mockResolvedValue({ maintenanceMode: true });
    const res = await controller.getMaintenanceMode();
    expect(res).toEqual({ maintenanceMode: true });
  });

  it("updates maintenance mode", async () => {
    settingsService.setMaintenanceMode.mockResolvedValue({ maintenanceMode: false });
    const res = await controller.updateMaintenanceMode({ maintenanceMode: false });
    expect(res).toEqual({ maintenanceMode: false });
    expect(settingsService.setMaintenanceMode).toHaveBeenCalledWith(false);
  });

  it("gets enforce 2FA status", async () => {
    settingsService.getEnforce2FA.mockResolvedValue({ enforce2FAGlobally: true });
    const res = await controller.getEnforce2FA();
    expect(res).toEqual({ enforce2FAGlobally: true });
  });

  it("updates enforce 2FA status", async () => {
    settingsService.setEnforce2FA.mockResolvedValue({ enforce2FAGlobally: true });
    const res = await controller.updateEnforce2FA({ enforce2FAGlobally: true });
    expect(res).toEqual({ enforce2FAGlobally: true });
    expect(settingsService.setEnforce2FA).toHaveBeenCalledWith(true);
  });
});
