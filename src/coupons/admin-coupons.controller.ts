import {
  Body,
  Controller,
  Delete,
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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@ApiTags("admin coupons")
@Controller("api/v1/admin/coupons")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: "Create a discount coupon (Admin)" })
  @ApiResponse({ status: 201, description: "Coupon created successfully." })
  async create(
    @Body() dto: CreateCouponDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.couponsService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: "List all discount coupons (Admin)" })
  async findAll(@Query() pagination: PaginationDto) {
    return this.couponsService.findAll({ page: pagination.page, limit: pagination.limit });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a discount coupon by id (Admin)" })
  async findOne(@Param("id") id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update or toggle a discount coupon (Admin)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.couponsService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a discount coupon (Admin)" })
  async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.couponsService.remove(id, req.user!.id);
  }
}
