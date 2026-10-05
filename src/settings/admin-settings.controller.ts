import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { UpdateAlertSettingsDto } from "./dto/update-alert-settings.dto";
import { UpdateEnforce2FaDto } from "./dto/update-enforce-2fa.dto";
import { UpdateMaintenanceModeDto } from "./dto/update-maintenance-mode.dto";
import { SettingsService } from "./settings.service";

@ApiTags("admin settings")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller(["api/admin", "api/v1/admin"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission("settings.manage")
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("maintenance-mode")
  @ApiOperation({ summary: "Get current maintenance mode status (Admin)" })
  @ApiResponse({ status: 200, description: "Maintenance mode status returned." })
  async getMaintenanceMode() {
    return this.settingsService.getMaintenanceMode();
  }

  @Put("maintenance-mode")
  @ApiOperation({ summary: "Update maintenance mode status (Admin)" })
  @ApiResponse({ status: 200, description: "Maintenance mode status updated." })
  async updateMaintenanceMode(@Body() dto: UpdateMaintenanceModeDto) {
    return this.settingsService.setMaintenanceMode(dto.maintenanceMode);
  }

  @Get("settings/enforce-2fa")
  @ApiOperation({ summary: "Get global 2FA enforcement status (Admin)" })
  @ApiResponse({ status: 200, description: "Enforce 2FA status returned." })
  async getEnforce2FA() {
    return this.settingsService.getEnforce2FA();
  }

  @Put("settings/enforce-2fa")
  @ApiOperation({ summary: "Update global 2FA enforcement status (Admin)" })
  @ApiResponse({ status: 200, description: "Enforce 2FA status updated." })
  async updateEnforce2FA(@Body() dto: UpdateEnforce2FaDto) {
    return this.settingsService.setEnforce2FA(dto.enforce2FAGlobally);
  }

  @Get("settings/alerts")
  @ApiOperation({ summary: "Get alert settings (Admin)" })
  @ApiResponse({ status: 200, description: "Alert settings returned." })
  async getAlertSettings() {
    return this.settingsService.getAlertSettings();
  }

  @Put("settings/alerts")
  @ApiOperation({ summary: "Update alert settings (Admin)" })
  @ApiResponse({ status: 200, description: "Alert settings updated." })
  async updateAlertSettings(@Body() dto: UpdateAlertSettingsDto) {
    return this.settingsService.updateAlertSettings(dto);
  }
}
