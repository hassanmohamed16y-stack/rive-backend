import { Module, forwardRef } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentModule } from "../payment/payment.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { InternalOrdersController } from "./internal-orders.controller";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [forwardRef(() => PaymentModule), NotificationsModule],
  controllers: [
    OrdersController,
    AdminOrdersController,
    InternalOrdersController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
