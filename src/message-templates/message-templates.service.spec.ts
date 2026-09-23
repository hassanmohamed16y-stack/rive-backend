import { Test, TestingModule } from "@nestjs/testing";
import { MessageTemplateChannel } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { MessageTemplatesService } from "./message-templates.service";

describe("MessageTemplatesService", () => {
  let service: MessageTemplatesService;
  let prisma: {
    messageTemplate: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditLogService: {
    record: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      messageTemplate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageTemplatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<MessageTemplatesService>(MessageTemplatesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("returns list of message templates ordered by key asc", async () => {
      const mockTemplates = [
        { id: "1", key: "low_stock_alert" },
        { id: "2", key: "order_confirmed" },
      ];
      prisma.messageTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.findAll();
      expect(result).toEqual(mockTemplates);
      expect(prisma.messageTemplate.findMany).toHaveBeenCalledWith({
        orderBy: { key: "asc" },
      });
    });
  });

  describe("update", () => {
    it("updates template fields and logs audit event", async () => {
      const existing = {
        id: "tpl-1",
        key: "order_confirmed",
        channel: MessageTemplateChannel.whatsapp,
        subject: null,
        bodyAr: "Old text {{orderNumber}}",
        bodyEn: "Old text {{orderNumber}}",
        isActive: true,
      };

      const updated = {
        ...existing,
        bodyAr: "New text {{orderNumber}}",
      };

      prisma.messageTemplate.findUnique.mockResolvedValue(existing);
      prisma.messageTemplate.update.mockResolvedValue(updated);

      const result = await service.update(
        "tpl-1",
        { bodyAr: "New text {{orderNumber}}" },
        "admin-user-123",
      );

      expect(result).toEqual(updated);
      expect(prisma.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: { bodyAr: "New text {{orderNumber}}" },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-123",
        action: "message-template.update",
        entityType: "MessageTemplate",
        entityId: "tpl-1",
        changes: {
          before: {
            subject: existing.subject,
            bodyAr: existing.bodyAr,
            bodyEn: existing.bodyEn,
            isActive: existing.isActive,
          },
          after: {
            subject: updated.subject,
            bodyAr: updated.bodyAr,
            bodyEn: updated.bodyEn,
            isActive: updated.isActive,
          },
        },
      });
    });
  });

  describe("renderTemplate", () => {
    it("renders placeholders correctly when template is found and active", async () => {
      prisma.messageTemplate.findUnique.mockResolvedValue({
        id: "tpl-1",
        key: "order_confirmed",
        channel: MessageTemplateChannel.whatsapp,
        subject: "Order {{orderNumber}}",
        bodyAr: "مرحباً {{customerName}}، تم استلام طلبك رقم #{{orderNumber}} بمبلغ {{totalAmount}}.",
        bodyEn: "Hello {{customerName}}, order #{{orderNumber}} received with total {{totalAmount}}.",
        isActive: true,
      });

      const rendered = await service.renderTemplate("order_confirmed", {
        customerName: "Aisha",
        orderNumber: "RIV-1001",
        totalAmount: "500",
      });

      expect(rendered).toEqual({
        key: "order_confirmed",
        channel: MessageTemplateChannel.whatsapp,
        subject: "Order RIV-1001",
        bodyAr: "مرحباً Aisha، تم استلام طلبك رقم #RIV-1001 بمبلغ 500.",
        bodyEn: "Hello Aisha, order #RIV-1001 received with total 500.",
        renderedText: "مرحباً Aisha، تم استلام طلبك رقم #RIV-1001 بمبلغ 500.",
      });
    });

    it("returns null if template is inactive", async () => {
      prisma.messageTemplate.findUnique.mockResolvedValue({
        id: "tpl-1",
        key: "order_confirmed",
        isActive: false,
      });

      const rendered = await service.renderTemplate("order_confirmed", {
        orderNumber: "RIV-1001",
      });

      expect(rendered).toBeNull();
    });

    it("returns null if template does not exist", async () => {
      prisma.messageTemplate.findUnique.mockResolvedValue(null);

      const rendered = await service.renderTemplate("nonexistent_key", {});

      expect(rendered).toBeNull();
    });
  });
});
