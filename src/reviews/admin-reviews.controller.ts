import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminReviewsQueryDto } from "./dto/admin-reviews-query.dto";
import { ApproveReviewDto } from "./dto/approve-review.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("admin reviews")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller("api/v1/admin/reviews")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @RequirePermission("products.view")
  @ApiOperation({ summary: "List reviews for moderation (Admin)" })
  @ApiQuery({ name: "isApproved", required: false, type: Boolean })
  async findAll(@Query() query: AdminReviewsQueryDto) {
    return this.reviewsService.findAllAdmin(query.isApproved, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Patch(":id/approve")
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Approve or reject a review (Admin)" })
  async setApproval(
    @Param("id") id: string,
    @Body() dto: ApproveReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reviewsService.setApproval(id, dto, req.user!.id);
  }

  @Delete(":id")
  @RequirePermission("products.edit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a review (Admin)" })
  async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reviewsService.removeReview(id, req.user!.id);
  }
}
