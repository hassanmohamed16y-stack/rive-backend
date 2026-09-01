import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create a new order (supports guest and authenticated users)' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data or insufficient stock' })
  async create(@Body() dto: CreateOrderDto, @Req() req: any) {
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
  async findOne(
    @Param('orderNumber') orderNumber: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const guestAccessToken = typeof req.headers?.['x-order-access-token'] === 'string'
      ? req.headers['x-order-access-token']
      : undefined;

    const order = await this.ordersService.findOne(orderNumber, guestAccessToken);

    if (userRole !== 'ADMIN') {
      const isOwner = order.userId !== null && order.userId === userId;
      const isGuestOwner = order.userId === null && guestAccessToken !== undefined && order.guestAccessToken === guestAccessToken;
      if (!isOwner && !isGuestOwner) {
        throw new ForbiddenException('You do not have permission to access this order');
      }
    }

    return order;
  }
}
