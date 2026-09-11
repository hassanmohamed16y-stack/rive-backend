import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { PaymobService } from "./paymob.service";

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentController],
  providers: [PaymobService, PaymentService],
  exports: [PaymobService, PaymentService],
})
export class PaymentModule {}
