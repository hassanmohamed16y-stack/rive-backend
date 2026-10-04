import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { PaymobService } from "./paymob.service";

@Module({
  imports: [AuthModule, NotificationsModule, forwardRef(() => OrdersModule)],
  controllers: [PaymentController],
  providers: [PaymobService, PaymentService],
  exports: [PaymobService, PaymentService],
})
export class PaymentModule {}
