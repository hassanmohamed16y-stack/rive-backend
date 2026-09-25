import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CouponsService } from "./coupons.service";
import { ValidateCouponDto } from "./dto/validate-coupon.dto";

@ApiTags("coupons")
@Controller("api/v1/coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post("validate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Validate and calculate discount for a coupon code" })
  @ApiResponse({ status: 200, description: "Coupon is valid." })
  @ApiResponse({ status: 400, description: "Coupon is invalid, expired, or limit reached." })
  async validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validateCoupon(dto.code, dto.subtotal);
  }
}
