import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminCouponsController } from "./admin-coupons.controller";
import { CouponsController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
