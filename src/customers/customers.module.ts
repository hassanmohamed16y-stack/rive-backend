import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminCustomersController } from "./admin-customers.controller";
import { AdminDataDeletionRequestsController } from "./admin-data-deletion-requests.controller";
import { CustomersService } from "./customers.service";
import { MeDeletionController } from "./me-deletion.controller";

@Module({
  imports: [PrismaModule, AuditLogModule, EmailModule],
  controllers: [
    AdminCustomersController,
    MeDeletionController,
    AdminDataDeletionRequestsController,
  ],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
