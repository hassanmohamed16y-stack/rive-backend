import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AddToWishlistDto } from "./dto/add-to-wishlist.dto";
import { WishlistService } from "./wishlist.service";

@ApiTags("wishlist")
@Controller("api/v1/wishlist")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "Get customer wishlist" })
  async getWishlist(@Req() req: AuthenticatedRequest) {
    return this.wishlistService.getWishlist(req.user!.id);
  }

  @Post()
  @ApiOperation({ summary: "Add product to wishlist" })
  @ApiResponse({ status: 201, description: "Product added to wishlist." })
  @ApiResponse({ status: 409, description: "Product is already in wishlist." })
  async addToWishlist(
    @Body() dto: AddToWishlistDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.wishlistService.addToWishlist(req.user!.id, dto.productId);
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove product from wishlist" })
  async removeFromWishlist(
    @Param("productId") productId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.wishlistService.removeFromWishlist(req.user!.id, productId);
  }
}
