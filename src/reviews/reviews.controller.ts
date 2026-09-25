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
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@Controller("api/v1/products")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(":productId/reviews")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Submit a product review" })
  @ApiResponse({ status: 201, description: "Review submitted successfully (pending admin approval)." })
  async createReview(
    @Param("productId") productId: string,
    @Body() dto: CreateReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reviewsService.createReview(
      productId,
      dto,
      req.user?.id,
      dto.authorName || req.user?.email,
    );
  }

  @Get(":productId/reviews")
  @ApiOperation({ summary: "Get approved reviews for a product" })
  async getApprovedReviews(
    @Param("productId") productId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getApprovedReviewsForProduct(productId, {
      page: pagination.page,
      limit: pagination.limit,
    });
  }
}
