import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { MetaService } from "./meta.service";

@ApiTags("admin meta")
@Controller("api/v1/admin/meta")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminMetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get("conversations")
  @ApiOperation({ summary: "Get social conversations (Facebook/Instagram) for Admin Dashboard" })
  @ApiResponse({ status: 200, description: "Paginated list of conversations returned." })
  async getConversations(
    @Query("platform") platform?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.metaService.findAllConversations(
      { platform, status, search },
      { page: pagination?.page, limit: pagination?.limit },
    );
  }

  @Get("conversations/:id/messages")
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
}
