import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  @ApiOperation({ summary: 'Create a new order (supports guest and authenticated users)' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data or insufficient stock' })
  async create(@Body() dto: CreateOrderDto, @Req() req: any) {
    const userId = req.user?.userId; // Optional: only present if JWT token provided
    return this.ordersService.create(dto, userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get(':orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve order details by order number (protected)' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied: not order owner or admin' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @Param('orderNumber') orderNumber: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const order = await this.ordersService.findOne(orderNumber);

    // Check ownership: allow if ADMIN, or if userId matches order's userId
    // Deny if order.userId is null and user is not ADMIN (guest orders only accessible to ADMIN)
    if (userRole !== 'ADMIN') {
      if (!order.userId || order.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to access this order',
        );
      }
    }

    return order;
  }
}
