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
import { TestWhatsAppDto } from "./dto/test-whatsapp.dto";
import { WhatsAppService } from "./whatsapp.service";

@ApiTags("admin notifications")
@Controller(["api/admin/notifications", "api/v1/admin/notifications"])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post("whatsapp/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a test WhatsApp message using Meta Cloud API (Admin)" })
  @ApiResponse({ status: 200, description: "Test message processed successfully." })
  @ApiResponse({ status: 400, description: "Credentials missing or Meta API error." })
  async testWhatsApp(@Body() dto: TestWhatsAppDto) {
    return this.whatsAppService.sendTestMessage(dto.recipientPhoneNumber, dto.message);
  }
}
