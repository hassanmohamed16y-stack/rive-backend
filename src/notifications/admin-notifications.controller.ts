import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
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
import { EmailService } from "../email/email.service";
import { SettingsService } from "../settings/settings.service";
import { TestAlertDto } from "./dto/test-alert.dto";
import { TestWhatsAppDto } from "./dto/test-whatsapp.dto";
import { WhatsAppService } from "./whatsapp.service";

@ApiTags("admin notifications")
@Controller(["api/admin/notifications", "api/v1/admin/notifications"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission("settings.manage")
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  @Post("whatsapp/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a test WhatsApp message using Meta Cloud API (Admin)" })
  @ApiResponse({ status: 200, description: "Test message processed successfully." })
  @ApiResponse({ status: 400, description: "Credentials missing or Meta API error." })
  async testWhatsApp(@Body() dto: TestWhatsAppDto) {
    return this.whatsAppService.sendTestMessage(dto.recipientPhoneNumber, dto.message);
  }

  @Post("test-alert")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a test alert email (Admin)" })
  @ApiResponse({ status: 200, description: "Test alert email sent successfully." })
  async testAlert(@Body() dto: TestAlertDto) {
    let targetEmail = dto.email?.trim();
    if (!targetEmail) {
      const alertSettings = await this.settingsService.getAlertSettings();
      if (alertSettings.alertEmails && alertSettings.alertEmails.length > 0) {
        targetEmail = alertSettings.alertEmails[0];
      } else {
        targetEmail = "admin@rive.com";
      }
    }

    await this.emailService.sendEmail({
      to: targetEmail,
      subject: "RIVÉ System Test Alert",
      html: "<p>This is a test notification alert from the <strong>RIVÉ Admin System</strong>.</p>",
      text: "This is a test notification alert from the RIVÉ Admin System.",
    });

    return {
      success: true,
      message: "Test alert email sent successfully.",
      sentTo: targetEmail,
    };
  }
}
