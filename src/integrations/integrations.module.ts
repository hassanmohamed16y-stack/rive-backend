import { Module } from "@nestjs/common";
import { AdminIntegrationsController } from "./admin-integrations.controller";
import { GoogleSheetsService } from "./google-sheets.service";

@Module({
  controllers: [AdminIntegrationsController],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class IntegrationsModule {}
