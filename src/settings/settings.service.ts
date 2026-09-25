import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSiteSettingsDto } from "./dto/update-site-settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSiteSettings() {
    let siteSettings = await this.prisma.siteSettings?.findUnique({
      where: { id: "default" },
    });

    if (!siteSettings) {
      siteSettings = await this.prisma.siteSettings.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          storeName: "RIVÉ",
          isMaintenanceMode: false,
          minimumOrderAmount: 0,
        },
      });
    }

    return siteSettings;
  }

  async updateSiteSettings(dto: UpdateSiteSettingsDto) {
    const updateData: any = { ...dto };
    if (dto.minimumOrderAmount !== undefined) {
      updateData.minimumOrderAmount = dto.minimumOrderAmount;
    }

    const updated = await this.prisma.siteSettings.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
        storeName: dto.storeName ?? "RIVÉ",
        logoUrl: dto.logoUrl,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        facebookUrl: dto.facebookUrl,
        instagramUrl: dto.instagramUrl,
        whatsappNumber: dto.whatsappNumber,
        tiktokUrl: dto.tiktokUrl,
        isMaintenanceMode: dto.isMaintenanceMode ?? false,
        minimumOrderAmount: dto.minimumOrderAmount ?? 0,
        businessHours: dto.businessHours,
      },
    });

    if (dto.isMaintenanceMode !== undefined && this.prisma.systemSettings) {
      await this.prisma.systemSettings.upsert({
        where: { id: "default" },
        update: { maintenanceMode: dto.isMaintenanceMode },
        create: { id: "default", maintenanceMode: dto.isMaintenanceMode },
      });
    }

    return updated;
  }

  async getSettings() {
    const siteSettings = await this.getSiteSettings();
    const systemSettings = await this.prisma.systemSettings?.findUnique({
      where: { id: "default" },
    });

    return {
      maintenanceMode: siteSettings.isMaintenanceMode || (systemSettings?.maintenanceMode ?? false),
      enforce2FAGlobally: systemSettings?.enforce2FAGlobally ?? false,
    };
  }

  async getMaintenanceMode() {
    const siteSettings = await this.getSiteSettings();
    return { maintenanceMode: siteSettings.isMaintenanceMode };
  }

  async setMaintenanceMode(maintenanceMode: boolean) {
    await this.updateSiteSettings({ isMaintenanceMode: maintenanceMode });
    if (this.prisma.systemSettings) {
      await this.prisma.systemSettings.upsert({
        where: { id: "default" },
        update: { maintenanceMode },
        create: { id: "default", maintenanceMode },
      });
    }
    return { maintenanceMode };
  }

  async getEnforce2FA() {
    const systemSettings = await this.prisma.systemSettings?.findUnique({
      where: { id: "default" },
    });
    return { enforce2FAGlobally: systemSettings?.enforce2FAGlobally ?? false };
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
