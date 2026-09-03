import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { InternalOrdersController } from './internal-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController, AdminOrdersController, InternalOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
