import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemListsController } from "./system-lists.controller";
import { SystemListsService } from "./system-lists.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [SystemListsController],
  providers: [SystemListsService],
  exports: [SystemListsService],
})
export class SystemListsModule {}
