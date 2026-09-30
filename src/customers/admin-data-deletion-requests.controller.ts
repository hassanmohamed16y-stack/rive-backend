import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CustomersService } from "./customers.service";
import { ListDeletionRequestsQueryDto } from "./dto/list-deletion-requests-query.dto";
import { RejectDeletionRequestDto } from "./dto/reject-deletion-request.dto";

@ApiTags("admin data deletion requests")
@Controller(["api/admin/data-deletion-requests", "api/v1/admin/data-deletion-requests"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@RequirePermission("data_deletion.manage")
@ApiBearerAuth()
export class AdminDataDeletionRequestsController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: "List data deletion requests (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated data deletion requests." })
  async findAll(@Query() query: ListDeletionRequestsQueryDto) {
    return this.customersService.findDeletionRequests(query);
  }

  @Patch(":id/approve")
  @ApiOperation({ summary: "Approve data deletion request & anonymize customer (Admin)" })
  @ApiResponse({ status: 200, description: "Request approved and customer anonymized." })
  @ApiResponse({ status: 404, description: "Request not found." })
  async approve(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.customersService.approveDeletionRequest(id, req.user!.id);
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Reject data deletion request (Admin)" })
  @ApiResponse({ status: 200, description: "Request rejected." })
  @ApiResponse({ status: 404, description: "Request not found." })
  async reject(
    @Param("id") id: string,
    @Body() dto: RejectDeletionRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customersService.rejectDeletionRequest(id, dto, req.user!.id);
  }
}
