import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MessageTemplatesController } from "./message-templates.controller";
import { MessageTemplatesService } from "./message-templates.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [MessageTemplatesController],
  providers: [MessageTemplatesService],
  exports: [MessageTemplatesService],
})
export class MessageTemplatesModule {}
