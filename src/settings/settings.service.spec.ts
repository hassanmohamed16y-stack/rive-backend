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
  };

  beforeEach(async () => {
    prisma = {
      systemSettings: {
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

  it("returns default settings when database entry does not exist", async () => {
    prisma.systemSettings.findUnique.mockResolvedValue(null);

    const settings = await service.getSettings();
    expect(settings).toEqual({
      maintenanceMode: false,
      enforce2FAGlobally: false,
    });
  });

  it("returns settings from database when present", async () => {
    prisma.systemSettings.findUnique.mockResolvedValue({
      id: "default",
      maintenanceMode: true,
      enforce2FAGlobally: true,
    });

    const settings = await service.getSettings();
    expect(settings).toEqual({
      maintenanceMode: true,
      enforce2FAGlobally: true,
    });
  });

  it("updates maintenance mode in database", async () => {
    prisma.systemSettings.upsert.mockResolvedValue({
      id: "default",
      maintenanceMode: true,
      enforce2FAGlobally: false,
    });

    const result = await service.setMaintenanceMode(true);
    expect(prisma.systemSettings.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      update: { maintenanceMode: true },
      create: { id: "default", maintenanceMode: true },
    });
    expect(result).toEqual({ maintenanceMode: true });
  });

  it("updates enforce 2FA in database", async () => {
    prisma.systemSettings.upsert.mockResolvedValue({
      id: "default",
      maintenanceMode: false,
      enforce2FAGlobally: true,
    });

    const result = await service.setEnforce2FA(true);
    expect(prisma.systemSettings.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      update: { enforce2FAGlobally: true },
      create: { id: "default", enforce2FAGlobally: true },
    });
    expect(result).toEqual({ enforce2FAGlobally: true });
  });
});
