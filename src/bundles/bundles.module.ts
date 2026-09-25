import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminBundlesController } from "./admin-bundles.controller";
import { BundlesController } from "./bundles.controller";
import { BundlesService } from "./bundles.service";

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [BundlesController, AdminBundlesController],
  providers: [BundlesService],
  exports: [BundlesService],
})
export class BundlesModule {}
