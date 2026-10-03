import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { EmailModule } from "../email/email.module";
import { MessageTemplatesModule } from "../message-templates/message-templates.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SettingsModule } from "../settings/settings.module";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminWhatsAppController } from "./admin-whatsapp.controller";
import { AdminWhatsAppService } from "./admin-whatsapp.service";
import { NotificationsService } from "./notifications.service";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    MessageTemplatesModule,
    SettingsModule,
    AuditLogModule,
  ],
  controllers: [
    AdminNotificationsController,
    WhatsAppController,
    AdminWhatsAppController,
  ],
  providers: [
    WhatsAppService,
    NotificationsService,
    AdminWhatsAppService,
  ],
  exports: [WhatsAppService, NotificationsService, AdminWhatsAppService],
})
export class NotificationsModule {}
