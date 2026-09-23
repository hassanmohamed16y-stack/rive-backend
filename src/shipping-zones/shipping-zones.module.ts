import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShippingZonesController } from "./shipping-zones.controller";
import { ShippingZonesService } from "./shipping-zones.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [ShippingZonesController],
  providers: [ShippingZonesService],
  exports: [ShippingZonesService],
})
export class ShippingZonesModule {}
