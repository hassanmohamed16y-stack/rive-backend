import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import {
  CustomersExportController,
  OrdersExportController,
  PaymentsExportController,
} from "./export.controller";
import { ExportService } from "./export.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [
    OrdersExportController,
    CustomersExportController,
    PaymentsExportController,
  ],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
