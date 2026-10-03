import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminWhatsAppController } from "./admin-whatsapp.controller";
import { AdminWhatsAppService } from "./admin-whatsapp.service";
import {
  decodeConversationKey,
  encodeConversationKey,
  isValidPhone,
  maskPhoneNumber,
} from "./whatsapp-conversation.util";
import { WhatsAppService } from "./whatsapp.service";

describe("AdminWhatsAppController & AdminWhatsAppService", () => {
  let controller: AdminWhatsAppController;

  const mockPrismaService = {
    whatsAppMessage: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  };

  const mockWhatsAppService = {
    sendMessage: jest.fn(),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue({ id: "audit_1" }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWhatsAppController],
      providers: [
        AdminWhatsAppService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    controller = module.get<AdminWhatsAppController>(AdminWhatsAppController);
  });

  describe("Utility Functions", () => {
    it("encodes and decodes conversation key accurately", () => {
      const phone = "201123456789";
      const key = encodeConversationKey(phone);
      expect(typeof key).toBe("string");
      expect(key).not.toContain("/");
      expect(key).not.toContain("+");
      expect(key).not.toContain("=");

      const decoded = decodeConversationKey(key);
      expect(decoded).toBe(phone);
    });

    it("validates phone numbers (8 to 15 digits)", () => {
      expect(isValidPhone("12345678")).toBe(true);
      expect(isValidPhone("123456789012345")).toBe(true);
      expect(isValidPhone("1234567")).toBe(false);
      expect(isValidPhone("1234567890123456")).toBe(false);
      expect(isValidPhone("20112345678a")).toBe(false);
    });

    it("masks phone numbers safely for display and logging", () => {
      const masked = maskPhoneNumber("201123456789");
      expect(masked).not.toBe("201123456789");
      expect(masked).toContain("89");
      expect(masked).toContain("•");
    });
  });

  describe("GET /api/v1/admin/whatsapp/conversations", () => {
    it("returns paginated grouped conversations with masked phones, customerName, and windowOpen status", async () => {
      const recipient = "201123456789";
      const key = encodeConversationKey(recipient);
      const now = new Date();

      mockPrismaService.whatsAppMessage.groupBy.mockResolvedValue([
        { recipient, _max: { createdAt: now } },
      ]);

      mockPrismaService.whatsAppMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          recipient,
          direction: "INBOUND",
          messageType: "text",
          body: "Hello store",
          status: "RECEIVED",
          createdAt: now,
        },
      ]);

      mockPrismaService.order.findMany.mockResolvedValue([
        { shippingPhone: "+201123456789", customerName: "Sara Ahmed" },
      ]);

      const result = await controller.getConversations({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          conversationKey: key,
          lastMessageText: "Hello store",
          lastDirection: "INBOUND",
          inboundCount: 1,
          windowOpen: true,
          customerName: "Sara Ahmed",
        }),
      );
      expect(result.data[0].phone).not.toBe(recipient);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("sets windowOpen to false when latest inbound message is older than 24 hours", async () => {
      const recipient = "201123456789";
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockPrismaService.whatsAppMessage.groupBy.mockResolvedValue([
        { recipient, _max: { createdAt: oldDate } },
      ]);

      mockPrismaService.whatsAppMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          recipient,
          direction: "INBOUND",
          messageType: "text",
          body: "Old message",
          status: "RECEIVED",
          createdAt: oldDate,
        },
      ]);

      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await controller.getConversations({ page: 1, limit: 20 });

      expect(result.data[0].windowOpen).toBe(false);
      expect(result.data[0].customerName).toBeNull();
    });
  });

  describe("GET /api/v1/admin/whatsapp/conversations/:conversationKey/messages", () => {
    it("returns decoded conversation messages without rawPayload", async () => {
      const recipient = "201123456789";
      const key = encodeConversationKey(recipient);
      const now = new Date();

      mockPrismaService.whatsAppMessage.count.mockResolvedValue(1);
      mockPrismaService.whatsAppMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          direction: "INBOUND",
          messageType: "text",
          body: "Hello store",
          status: "RECEIVED",
          createdAt: now,
        },
      ]);
      mockPrismaService.whatsAppMessage.findFirst.mockResolvedValue({
        id: "m1",
        createdAt: now,
      });
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await controller.getConversationMessages(key, { page: 1, limit: 20 });

      expect(result.conversation.conversationKey).toBe(key);
      expect(result.conversation.windowOpen).toBe(true);
      expect(result.messages.data).toHaveLength(1);
      expect(result.messages.data[0]).not.toHaveProperty("rawPayload");
    });

    it("throws 404 NotFoundException on invalid conversation key or phone", async () => {
      const invalidKey = "invalid_key_xyz!";
      await expect(
        controller.getConversationMessages(invalidKey, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("POST /api/v1/admin/whatsapp/conversations/:conversationKey/messages", () => {
    it("sends reply successfully when window is open and records audit log without text body", async () => {
      const recipient = "201123456789";
      const key = encodeConversationKey(recipient);
      const now = new Date();

      mockPrismaService.whatsAppMessage.findFirst
        .mockResolvedValueOnce({
          id: "inbound_1",
          direction: "INBOUND",
          createdAt: now,
        })
        .mockResolvedValueOnce({
          id: "outbound_1",
          direction: "OUTBOUND",
          messageType: "text",
          body: "Hello customer",
          status: "SENT",
          createdAt: new Date(),
        });

      mockWhatsAppService.sendMessage.mockResolvedValue({ success: true, messageId: "wmid.123" });

      const req = { user: { id: "admin_user_1" } } as any;
      const result = await controller.replyToConversation(key, { text: "Hello customer" }, req);

      expect(mockWhatsAppService.sendMessage).toHaveBeenCalledWith(
        recipient,
        "Hello customer",
        "text",
      );

      expect(mockAuditLogService.record).toHaveBeenCalledWith({
        userId: "admin_user_1",
        action: "whatsapp.message.send",
        entityType: "WhatsAppConversation",
        entityId: expect.not.stringContaining(recipient),
        changes: { textLength: 14 },
      });

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty("rawPayload");
      expect(result?.body).toBe("Hello customer");
    });

    it("throws 400 BadRequestException when 24-hour reply window is expired", async () => {
      const recipient = "201123456789";
      const key = encodeConversationKey(recipient);
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockPrismaService.whatsAppMessage.findFirst.mockResolvedValue({
        id: "inbound_1",
        direction: "INBOUND",
        createdAt: oldDate,
      });

      const req = { user: { id: "admin_user_1" } } as any;

      await expect(
        controller.replyToConversation(key, { text: "Hello customer" }, req),
      ).rejects.toThrow(BadRequestException);

      expect(mockWhatsAppService.sendMessage).not.toHaveBeenCalled();
    });

    it("throws 400 BadRequestException when no inbound message exists for recipient", async () => {
      const recipient = "201123456789";
      const key = encodeConversationKey(recipient);

      mockPrismaService.whatsAppMessage.findFirst.mockResolvedValue(null);

      const req = { user: { id: "admin_user_1" } } as any;

      await expect(
        controller.replyToConversation(key, { text: "Hello customer" }, req),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
