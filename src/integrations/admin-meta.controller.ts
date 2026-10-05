import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminMetaConversationsQueryDto } from "./dto/admin-meta-conversations-query.dto";
import { SendMetaMessageDto } from "./dto/send-meta-message.dto";
import { MetaService } from "./meta.service";

@ApiTags("admin meta")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller("api/v1/admin/meta")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminMetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get("conversations")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get social conversations (Facebook/Instagram) for Admin Dashboard" })
  @ApiResponse({ status: 200, description: "Paginated list of conversations returned." })
  async getConversations(@Query() query: AdminMetaConversationsQueryDto) {
    return this.metaService.findAllConversations(
      { platform: query.platform, status: query.status, search: query.search },
      { page: query.page, limit: query.limit },
    );
  }

  @Get("conversations/:id/messages")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get messages for a conversation" })
  @ApiResponse({ status: 200, description: "Conversation messages returned." })
  async getMessages(
    @Param("id") id: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.metaService.findConversationMessages(id, {
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Post("conversations/:id/messages")
  @RequirePermission("customers.update")
  @ApiOperation({ summary: "Reply to a Facebook Messenger or Instagram conversation" })
  @ApiResponse({ status: 201, description: "Reply message sent and stored." })
  async sendReply(
    @Param("id") id: string,
    @Body() dto: SendMetaMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.metaService.sendReply(id, dto.text, req.user?.id);
  }
}
