import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminWhatsAppService } from "./admin-whatsapp.service";
import { SendWhatsAppReplyDto, WhatsAppPaginationQueryDto } from "./dto/whatsapp-reply.dto";

@ApiTags("admin whatsapp")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller(["api/admin/whatsapp", "api/v1/admin/whatsapp"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminWhatsAppController {
  constructor(private readonly adminWhatsAppService: AdminWhatsAppService) {}

  @Get("conversations")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get paginated list of WhatsApp conversations (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated list of conversations returned." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async getConversations(@Query() query: WhatsAppPaginationQueryDto) {
    return this.adminWhatsAppService.getConversations(query);
  }

  @Get("conversations/:conversationKey/messages")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get message history for a WhatsApp conversation (Admin)" })
  @ApiResponse({ status: 200, description: "Conversation message history returned." })
  @ApiResponse({ status: 404, description: "Conversation not found or invalid key." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async getConversationMessages(
    @Param("conversationKey") conversationKey: string,
    @Query() query: WhatsAppPaginationQueryDto,
  ) {
    return this.adminWhatsAppService.getConversationMessages(conversationKey, query);
  }

  @Post("conversations/:conversationKey/messages")
  @RequirePermission("customers.update")
  @ApiOperation({ summary: "Send a free-text reply in a WhatsApp conversation (Admin)" })
  @ApiResponse({ status: 201, description: "Reply sent successfully." })
  @ApiResponse({ status: 400, description: "24-hour window expired or invalid body." })
  @ApiResponse({ status: 404, description: "Conversation not found." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  @ApiResponse({ status: 502, description: "WhatsApp API error or token renewal required." })
  @ApiResponse({ status: 503, description: "WhatsApp service not configured." })
  async replyToConversation(
    @Param("conversationKey") conversationKey: string,
    @Body() dto: SendWhatsAppReplyDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.adminWhatsAppService.replyToConversation(conversationKey, dto, req.user?.id);
  }
}
