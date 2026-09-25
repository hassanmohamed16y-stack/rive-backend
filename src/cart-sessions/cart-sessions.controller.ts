import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CartSessionsService } from "./cart-sessions.service";
import { SyncCartDto } from "./dto/sync-cart.dto";

@ApiTags("cart")
@Controller("api/v1/cart")
export class CartSessionsController {
  constructor(private readonly cartSessionsService: CartSessionsService) {}

  @Post("sync")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Sync customer cart session" })
  async syncCart(
    @Body() dto: SyncCartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartSessionsService.syncCart(dto, req.user?.id);
  }
}
