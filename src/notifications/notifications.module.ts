import { Module } from "@nestjs/common";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  controllers: [AdminNotificationsController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class NotificationsModule {}
