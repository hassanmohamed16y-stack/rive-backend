import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StaticPagesController } from "./static-pages.controller";
import { StaticPagesService } from "./static-pages.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [StaticPagesController],
  providers: [StaticPagesService],
  exports: [StaticPagesService],
})
export class StaticPagesModule {}
