import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data or insufficient stock' })
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

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

    // Check ownership: allow if ADMIN or if userId matches order's userId
    if (userRole !== 'ADMIN' && order.userId && order.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this order',
      );
    }

    return order;
  }
}
