import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpdateMessageTemplateDto } from "./dto/update-message-template.dto";
import { MessageTemplatesService } from "./message-templates.service";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

@ApiTags("message-templates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller(["message-templates", "api/v1/message-templates", "api/v1/admin/message-templates"])
export class MessageTemplatesController {
  constructor(private readonly messageTemplatesService: MessageTemplatesService) {}

  @Get()
  @RequirePermission("templates.view")
  @ApiOperation({ summary: "List all notification message templates" })
  @ApiResponse({ status: 200, description: "Message templates retrieved successfully." })
  async findAll() {
    return this.messageTemplatesService.findAll();
  }

  @Patch(":id")
  @RequirePermission("templates.edit")
  @ApiOperation({ summary: "Update a notification message template" })
  @ApiResponse({ status: 200, description: "Message template updated successfully." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateMessageTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messageTemplatesService.update(id, dto, req.user!.id);
  }
}
