import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by id with full detail (Admin)' })
  @ApiResponse({ status: 200, description: 'Order returned successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findByIdForAdmin(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition an order to a valid status (Admin)' })
  @ApiResponse({ status: 200, description: 'Order status updated.' })
  @ApiResponse({ status: 409, description: 'Invalid order status transition.' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() req: AuthenticatedRequest) {
    return this.ordersService.transitionStatus(id, dto.status, req.user!.id);
  }
}
