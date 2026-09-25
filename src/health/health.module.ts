import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { HealthController } from "./health.controller";
import { AlertService } from "./alert.service";

@Module({
  imports: [PrismaModule, AuthModule, EmailModule],
  controllers: [HealthController],
  providers: [AlertService],
  exports: [AlertService],
})
export class HealthModule {}
