import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
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

  private assertOrderAccess(order: { userId: string | null; guestAccessToken?: string | null }, req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const guestAccessToken = this.getGuestAccessToken(req);

    if (userRole === 'ADMIN') {
      return guestAccessToken;
    }

    const isOwner = order.userId !== null && order.userId === userId;
    const isGuestOwner = order.userId === null
      && timingSafeStringEqual(order.guestAccessToken, guestAccessToken);

    if (!isOwner && !isGuestOwner) {
      throw new ForbiddenException('You do not have permission to access this order');
    }

    return guestAccessToken;
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
  @ApiResponse({ status: 403, description: 'Access denied: not order owner or admin' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('orderNumber') orderNumber: string, @Req() req: AuthenticatedRequest) {
    const guestAccessToken = this.getGuestAccessToken(req);
    const order = await this.ordersService.findOne(orderNumber, guestAccessToken);
    this.assertOrderAccess(order, req);
    return order;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':orderNumber/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Access-Token', required: false, description: 'Required to cancel a guest order.' })
  @ApiOperation({ summary: 'Cancel a pending order as its authenticated owner, an admin, or its guest access-token holder' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Access denied: not order owner or admin' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Only pending orders can be cancelled' })
  async cancel(@Param('orderNumber') orderNumber: string, @Req() req: AuthenticatedRequest) {
    const guestAccessToken = this.getGuestAccessToken(req);
    const order = await this.ordersService.findOne(orderNumber, guestAccessToken);
    this.assertOrderAccess(order, req);
    return this.ordersService.cancelByOrderNumber(orderNumber);
  }
}
