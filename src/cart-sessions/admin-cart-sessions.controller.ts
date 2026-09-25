import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { CartSessionsService } from "./cart-sessions.service";

@ApiTags("admin cart sessions")
@Controller("api/v1/admin/carts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCartSessionsController {
  constructor(private readonly cartSessionsService: CartSessionsService) {}

  @Get("abandoned")
  @ApiOperation({ summary: "List abandoned carts (Admin)" })
  @ApiQuery({ name: "inactivityMinutes", required: false, type: Number })
  async getAbandoned(
    @Query("inactivityMinutes") inactivityMinutes?: number,
    @Query() pagination?: PaginationDto,
  ) {
    const mins = inactivityMinutes ? Number(inactivityMinutes) : 30;
    return this.cartSessionsService.getAbandonedCarts(mins, {
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }
}
