import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuditLogService } from "./audit-log.service";
import { GetAuditLogsDto } from "./dto/get-audit-logs.dto";

@ApiTags("admin audit logs")
@Controller([
  "api/v1/admin/audit-logs",
  "api/admin/audit-logs",
  "api/v1/audit-logs",
])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get activity audit logs with filtering by user, action, entity, and date range (Admin)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of activity audit logs returned successfully.",
  })
  async findAll(@Query() query: GetAuditLogsDto) {
    return this.auditLogService.findAll(query);
  }
}
