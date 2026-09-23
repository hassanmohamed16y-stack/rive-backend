import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { MessageTemplatesModule } from "../message-templates/message-templates.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { NotificationsService } from "./notifications.service";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  imports: [PrismaModule, EmailModule, MessageTemplatesModule],
  controllers: [AdminNotificationsController, WhatsAppController],
  providers: [WhatsAppService, NotificationsService],
  exports: [WhatsAppService, NotificationsService],
})
export class NotificationsModule {}
