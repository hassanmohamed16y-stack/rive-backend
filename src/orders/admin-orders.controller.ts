import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('admin orders')
@Controller('api/v1/admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders with status filtering and pagination (Admin)' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiResponse({ status: 200, description: 'Paginated orders returned.', schema: { properties: { data: { type: 'array', items: { type: 'object' } }, meta: { type: 'object' } } } })
  async findAll(@Query('status') status: OrderStatus | undefined, @Query() pagination: PaginationDto) {
    return this.ordersService.findAll({ status }, pagination);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition an order to a valid status (Admin)' })
  @ApiResponse({ status: 200, description: 'Order status updated.' })
  @ApiResponse({ status: 409, description: 'Invalid order status transition.' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.transitionStatus(id, dto.status);
  }
}