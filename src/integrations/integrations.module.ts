import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminIntegrationsController } from "./admin-integrations.controller";
import { AdminMetaController } from "./admin-meta.controller";
import { ExcelController } from "./excel.controller";
import { ExcelService } from "./excel.service";
import { GoogleSheetsService } from "./google-sheets.service";
import { MetaController } from "./meta.controller";
import { MetaService } from "./meta.service";

@Module({
  imports: [PrismaModule, AuthModule, AuditLogModule],
  controllers: [
    AdminIntegrationsController,
    MetaController,
    AdminMetaController,
    ExcelController,
  ],
  providers: [GoogleSheetsService, MetaService, ExcelService],
  exports: [GoogleSheetsService, MetaService, ExcelService],
})
export class IntegrationsModule {}
