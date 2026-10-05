import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CartSessionsService } from "./cart-sessions.service";
import { AbandonedCartsQueryDto } from "./dto/abandoned-carts-query.dto";

@ApiTags("admin cart sessions")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller("api/v1/admin/carts")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCartSessionsController {
  constructor(private readonly cartSessionsService: CartSessionsService) {}

  @Get("abandoned")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "List abandoned carts (Admin)" })
  async getAbandoned(@Query() query: AbandonedCartsQueryDto) {
    const mins = query.inactivityMinutes ?? 30;
    return this.cartSessionsService.getAbandonedCarts(mins, {
      page: query.page,
      limit: query.limit,
    });
  }
}
