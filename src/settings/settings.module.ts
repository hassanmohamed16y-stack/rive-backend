import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminSettingsController } from "./admin-settings.controller";
import { SiteSettingsController } from "./site-settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminSettingsController, SiteSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
