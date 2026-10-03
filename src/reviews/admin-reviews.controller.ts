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
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ApproveReviewDto } from "./dto/approve-review.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("admin reviews")
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
  async findAll(
    @Query("isApproved") isApproved?: string,
    @Query() pagination?: PaginationDto,
  ) {
    const approvedFilter = isApproved !== undefined ? isApproved === "true" : undefined;
    return this.reviewsService.findAllAdmin(approvedFilter, {
      page: pagination?.page,
      limit: pagination?.limit,
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
