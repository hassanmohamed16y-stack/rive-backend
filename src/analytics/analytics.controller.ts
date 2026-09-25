import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@Controller("api/v1/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get sales & growth analytics overview (Admin)" })
  @ApiResponse({ status: 200, description: "Analytics overview data returned." })
  async getOverview() {
    return this.analyticsService.getOverview();
  }
}
