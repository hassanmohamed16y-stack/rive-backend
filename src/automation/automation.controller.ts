import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AutomationService } from "./automation.service";
import { GetPendingApprovalsQueryDto } from "./dto/get-pending-approvals-query.dto";
import { GetRunsQueryDto } from "./dto/get-runs-query.dto";
import { ToggleWorkflowDto } from "./dto/toggle-workflow.dto";
import { UpdateTrustLevelDto } from "./dto/update-trust-level.dto";

@ApiTags("automation")
@Controller(["automation", "api/v1/automation", "api/v1/admin/automation"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission("automation.manage")
@Roles("ADMIN")
@ApiBearerAuth()
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get("workflows")
  @ApiOperation({ summary: "List all automation workflows with their status" })
  @ApiResponse({ status: 200, description: "Workflows retrieved successfully." })
  async getWorkflows() {
    return this.automationService.getWorkflows();
  }

  @Patch("workflows/:id/toggle")
  @ApiOperation({ summary: "Toggle workflow active state" })
  @ApiResponse({ status: 200, description: "Workflow active state updated." })
  @ApiResponse({ status: 404, description: "Workflow not found." })
  async toggleWorkflow(
    @Param("id") id: string,
    @Body() dto: ToggleWorkflowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.automationService.toggleWorkflow(id, req.user!.id, dto);
  }

  @Patch("workflows/:id/trust-level")
  @ApiOperation({ summary: "Change workflow trust level" })
  @ApiResponse({ status: 200, description: "Workflow trust level updated." })
  @ApiResponse({ status: 404, description: "Workflow not found." })
  async updateTrustLevel(
    @Param("id") id: string,
    @Body() dto: UpdateTrustLevelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.automationService.updateTrustLevel(
      id,
      dto.trustLevel,
      req.user!.id,
    );
  }

  @Get("runs")
  @ApiOperation({ summary: "Get recent run logs (paginated, optionally filtered by workflowId)" })
  @ApiResponse({ status: 200, description: "Run logs retrieved successfully." })
  async getRuns(@Query() query: GetRunsQueryDto) {
    return this.automationService.getRuns(query);
  }

  @Get("pending-approvals")
  @ApiOperation({ summary: "List pending approvals" })
  @ApiResponse({ status: 200, description: "Pending approvals retrieved successfully." })
  async getPendingApprovals(@Query() query: GetPendingApprovalsQueryDto) {
    return this.automationService.getPendingApprovals(query);
  }

  @Post("pending-approvals/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a pending approval" })
  @ApiResponse({ status: 200, description: "Pending approval approved." })
  @ApiResponse({ status: 400, description: "Pending approval already resolved." })
  @ApiResponse({ status: 404, description: "Pending approval not found." })
  async approvePendingApproval(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.automationService.approvePendingApproval(id, req.user!.id);
  }

  @Post("pending-approvals/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a pending approval" })
  @ApiResponse({ status: 200, description: "Pending approval rejected." })
  @ApiResponse({ status: 400, description: "Pending approval already resolved." })
  @ApiResponse({ status: 404, description: "Pending approval not found." })
  async rejectPendingApproval(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.automationService.rejectPendingApproval(id, req.user!.id);
  }
}
