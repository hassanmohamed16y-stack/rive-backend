import { Test, TestingModule } from "@nestjs/testing";
import { SiteSettingsController } from "./site-settings.controller";
import { SettingsService } from "./settings.service";

describe("SiteSettingsController", () => {
  let controller: SiteSettingsController;
  let settingsService: {
    getSiteSettings: jest.Mock;
    updateSiteSettings: jest.Mock;
  };

  beforeEach(async () => {
    settingsService = {
      getSiteSettings: jest.fn(),
      updateSiteSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteSettingsController],
      providers: [{ provide: SettingsService, useValue: settingsService }],
    }).compile();

    controller = module.get<SiteSettingsController>(SiteSettingsController);
  });

  it("gets public site settings", async () => {
    const mockSettings = { id: "default", storeName: "RIVÉ", freeShippingThreshold: 500 };
    settingsService.getSiteSettings.mockResolvedValue(mockSettings);

    const res = await controller.getPublicSiteSettings();
    expect(res).toEqual(mockSettings);
    expect(settingsService.getSiteSettings).toHaveBeenCalled();
  });

  it("gets site settings for admin", async () => {
    const mockSettings = { id: "default", storeName: "RIVÉ", freeShippingThreshold: 500 };
    settingsService.getSiteSettings.mockResolvedValue(mockSettings);

    const res = await controller.getSiteSettings();
    expect(res).toEqual(mockSettings);
    expect(settingsService.getSiteSettings).toHaveBeenCalled();
  });

  it("updates site settings via PATCH with freeShippingThreshold number", async () => {
    const dto = { storeName: "RIVÉ", freeShippingThreshold: 350 };
    const mockResponse = { id: "default", ...dto };
    settingsService.updateSiteSettings.mockResolvedValue(mockResponse);

    const res = await controller.updateSiteSettings(dto);
    expect(res).toEqual(mockResponse);
    expect(settingsService.updateSiteSettings).toHaveBeenCalledWith(dto);
  });

  it("updates site settings via PATCH with freeShippingThreshold null", async () => {
    const dto = { freeShippingThreshold: null };
    const mockResponse = { id: "default", storeName: "RIVÉ", freeShippingThreshold: null };
    settingsService.updateSiteSettings.mockResolvedValue(mockResponse);

    const res = await controller.updateSiteSettings(dto);
    expect(res).toEqual(mockResponse);
    expect(settingsService.updateSiteSettings).toHaveBeenCalledWith(dto);
  });
});
