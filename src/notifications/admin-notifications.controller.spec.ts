import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "../email/email.service";
import { SettingsService } from "../settings/settings.service";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { WhatsAppService } from "./whatsapp.service";

describe("AdminNotificationsController", () => {
  let controller: AdminNotificationsController;
  let whatsAppService: { sendTestMessage: jest.Mock };
  let emailService: { sendEmail: jest.Mock };
  let settingsService: { getAlertSettings: jest.Mock };

  beforeEach(async () => {
    whatsAppService = {
      sendTestMessage: jest.fn(),
    };
    emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    settingsService = {
      getAlertSettings: jest.fn().mockResolvedValue({
        alertEmails: ["configured@rive.com"],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminNotificationsController],
      providers: [
        { provide: WhatsAppService, useValue: whatsAppService },
        { provide: EmailService, useValue: emailService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    controller = module.get<AdminNotificationsController>(AdminNotificationsController);
  });

  it("delegates test message sending to WhatsAppService", async () => {
    whatsAppService.sendTestMessage.mockResolvedValue({ success: true, messageId: "msg-123" });

    const result = await controller.testWhatsApp({
      recipientPhoneNumber: "+201234567890",
      message: "Test message",
    });

    expect(whatsAppService.sendTestMessage).toHaveBeenCalledWith(
      "+201234567890",
      "Test message",
    );
    expect(result).toEqual({ success: true, messageId: "msg-123" });
  });
});
