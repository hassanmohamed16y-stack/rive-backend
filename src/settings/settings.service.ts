import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateAlertSettingsDto } from "./dto/update-alert-settings.dto";
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

  async getAlertSettings() {
    let alertSettings = await this.prisma.alertSettings?.findUnique({
      where: { id: "default" },
    });

    if (!alertSettings) {
      alertSettings = await this.prisma.alertSettings.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          lowStockThreshold: 5,
          alertEmails: [],
          newOrderAlertsEnabled: true,
          lowStockAlertsEnabled: true,
          failedPaymentAlertsEnabled: true,
        },
      });
    }

    return alertSettings;
  }

  async updateAlertSettings(dto: UpdateAlertSettingsDto) {
    const current = await this.getAlertSettings();
    const updated = await this.prisma.alertSettings.upsert({
      where: { id: "default" },
      update: {
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
        ...(dto.alertEmails !== undefined && { alertEmails: dto.alertEmails }),
        ...(dto.newOrderAlertsEnabled !== undefined && { newOrderAlertsEnabled: dto.newOrderAlertsEnabled }),
        ...(dto.lowStockAlertsEnabled !== undefined && { lowStockAlertsEnabled: dto.lowStockAlertsEnabled }),
        ...(dto.failedPaymentAlertsEnabled !== undefined && { failedPaymentAlertsEnabled: dto.failedPaymentAlertsEnabled }),
      },
      create: {
        id: "default",
        lowStockThreshold: dto.lowStockThreshold ?? current.lowStockThreshold,
        alertEmails: dto.alertEmails ?? current.alertEmails,
        newOrderAlertsEnabled: dto.newOrderAlertsEnabled ?? current.newOrderAlertsEnabled,
        lowStockAlertsEnabled: dto.lowStockAlertsEnabled ?? current.lowStockAlertsEnabled,
        failedPaymentAlertsEnabled: dto.failedPaymentAlertsEnabled ?? current.failedPaymentAlertsEnabled,
      },
    });

    return updated;
  }
}
