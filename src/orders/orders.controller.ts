import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'Retrieve order details by order number' })
  async findOne(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findOne(orderNumber);
  }
}
