import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { InternalNotesController } from "./internal-notes.controller";
import { InternalNotesService } from "./internal-notes.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [InternalNotesController],
  providers: [InternalNotesService],
  exports: [InternalNotesService],
})
export class InternalNotesModule {}
