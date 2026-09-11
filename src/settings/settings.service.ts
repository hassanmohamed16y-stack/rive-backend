import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.systemSettings?.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      return {
        maintenanceMode: false,
        enforce2FAGlobally: false,
      };
    }

    return {
      maintenanceMode: settings.maintenanceMode,
      enforce2FAGlobally: settings.enforce2FAGlobally,
    };
  }

  async getMaintenanceMode() {
    const settings = await this.getSettings();
    return { maintenanceMode: settings.maintenanceMode };
  }

  async setMaintenanceMode(maintenanceMode: boolean) {
    const updated = await this.prisma.systemSettings.upsert({
      where: { id: "default" },
      update: { maintenanceMode },
      create: { id: "default", maintenanceMode },
    });

    return { maintenanceMode: updated.maintenanceMode };
  }

  async getEnforce2FA() {
    const settings = await this.getSettings();
    return { enforce2FAGlobally: settings.enforce2FAGlobally };
  }

  async setEnforce2FA(enforce2FAGlobally: boolean) {
    const updated = await this.prisma.systemSettings.upsert({
      where: { id: "default" },
      update: { enforce2FAGlobally },
      create: { id: "default", enforce2FAGlobally },
    });

    return { enforce2FAGlobally: updated.enforce2FAGlobally };
  }
}
