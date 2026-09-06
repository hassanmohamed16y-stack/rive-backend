import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getGuestAccessToken(req: AuthenticatedRequest): string | undefined {
    return typeof req.headers?.['x-order-access-token'] === 'string'
      ? req.headers['x-order-access-token']
      : undefined;
  }

  /**
   * Ownership is enforced by `OrdersService.findOne` itself (via the shared
   * `isOrderOwnedByActor` helper), which throws a 404 - not a 403 - for any
   * actor that isn't the order's owner/guest-token holder/an admin. This
   * keeps the response indistinguishable from "order does not exist" for
   * both guest and authenticated callers, instead of leaking existence via
   * a 403 vs 404 split.
   */
  private findOrderForActor(orderNumber: string, req: AuthenticatedRequest) {
    return this.ordersService.findOne(orderNumber, {
      userId: req.user?.userId,
      role: req.user?.role,
      guestAccessToken: this.getGuestAccessToken(req),
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create a new order (supports guest and authenticated users)' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data or insufficient stock' })
  async create(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    return this.ordersService.create(dto, userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get(':orderNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Access-Token', required: false, description: 'Required to access a guest order.' })
  @ApiOperation({ summary: 'Retrieve an order as its authenticated owner, an admin, or its guest access-token holder' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found, or the requester is not its owner/admin/guest-token holder' })
  async findOne(@Param('orderNumber') orderNumber: string, @Req() req: AuthenticatedRequest) {
    return this.findOrderForActor(orderNumber, req);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':orderNumber/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Access-Token', required: false, description: 'Required to cancel a guest order.' })
  @ApiOperation({ summary: 'Cancel a pending order as its authenticated owner, an admin, or its guest access-token holder' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found, or the requester is not its owner/admin/guest-token holder' })
  @ApiResponse({ status: 409, description: 'Only pending orders can be cancelled' })
  async cancel(@Param('orderNumber') orderNumber: string, @Req() req: AuthenticatedRequest) {
    const order = await this.findOrderForActor(orderNumber, req);
    return this.ordersService.cancelByOrderNumber(order.orderNumber);
  }
}
