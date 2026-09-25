import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  let service: SettingsService;
  let prisma: {
    systemSettings: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    siteSettings: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      systemSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      siteSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it("returns default site settings when database entry does not exist", async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.siteSettings.upsert.mockResolvedValue({
      id: "default",
      storeName: "RIVÉ",
      isMaintenanceMode: false,
      minimumOrderAmount: 0,
    });

    const settings = await service.getSiteSettings();
    expect(settings.storeName).toBe("RIVÉ");
  });

  it("updates site settings in database", async () => {
    const updatedMock = {
      id: "default",
      storeName: "RIVÉ Luxury",
      phone: "+201000000000",
      isMaintenanceMode: true,
      minimumOrderAmount: 150,
    };
    prisma.siteSettings.upsert.mockResolvedValue(updatedMock);

    const result = await service.updateSiteSettings({
      storeName: "RIVÉ Luxury",
      phone: "+201000000000",
      isMaintenanceMode: true,
      minimumOrderAmount: 150,
    });

    expect(prisma.siteSettings.upsert).toHaveBeenCalled();
    expect(result.storeName).toBe("RIVÉ Luxury");
  });

  it("updates maintenance mode in database", async () => {
    prisma.siteSettings.upsert.mockResolvedValue({
      id: "default",
      storeName: "RIVÉ",
      isMaintenanceMode: true,
    });
    prisma.systemSettings.upsert.mockResolvedValue({
      id: "default",
      maintenanceMode: true,
      enforce2FAGlobally: false,
    });

    const result = await service.setMaintenanceMode(true);
    expect(result).toEqual({ maintenanceMode: true });
  });
});
