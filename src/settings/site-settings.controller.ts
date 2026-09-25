import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SettingsService } from "./settings.service";
import { UpdateSiteSettingsDto } from "./dto/update-site-settings.dto";

@ApiTags("settings")
@Controller("api/v1/settings")
export class SiteSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("site/public")
  @ApiOperation({ summary: "Get public site settings" })
  @ApiResponse({ status: 200, description: "Public site settings returned." })
  async getPublicSiteSettings() {
    return this.settingsService.getSiteSettings();
  }

  @Get("site")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermission("settings.manage")
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get site settings (Admin)" })
  @ApiResponse({ status: 200, description: "Site settings returned." })
  async getSiteSettings() {
    return this.settingsService.getSiteSettings();
  }

  @Patch("site")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermission("settings.manage")
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update site settings (Admin)" })
  @ApiResponse({ status: 200, description: "Site settings updated." })
  async updateSiteSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.settingsService.updateSiteSettings(dto);
  }
}
