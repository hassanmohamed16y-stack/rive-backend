import { Test, TestingModule } from "@nestjs/testing";
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MetaService } from "./meta.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("MetaService & Meta Webhook Reply", () => {
  let service: MetaService;
  let prisma: any;
  let auditLogService: any;
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.META_PAGE_ACCESS_TOKEN = "test-page-access-token";

    prisma = {
      metaConversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      metaMessage: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<MetaService>(MetaService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("handleWebhookPayload", () => {
    it("should store inbound customer message", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(null);
      prisma.metaConversation.create.mockResolvedValue({ id: "conv-1" });

      const payload = {
        entry: [
          {
            id: "page-123",
            messaging: [
              {
                sender: { id: "cust-1" },
                message: { text: "Hello store" },
              },
            ],
          },
        ],
      };

      const result = await service.handleWebhookPayload(payload);
      expect(result).toEqual({ success: true });
      expect(prisma.metaMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "conv-1",
          sender: "CUSTOMER",
          text: "Hello store",
        }),
      });
    });

    it("should ignore echo messages and not store them as CUSTOMER messages", async () => {
      const payload = {
        entry: [
          {
            id: "page-123",
            messaging: [
              {
                sender: { id: "page-123" },
                message: { text: "Hello back", is_echo: true },
              },
            ],
          },
        ],
      };

      const result = await service.handleWebhookPayload(payload);
      expect(result).toEqual({ success: true });
      expect(prisma.metaConversation.findUnique).not.toHaveBeenCalled();
      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
    });

    it("should ignore delivery and read receipts", async () => {
      const payload = {
        entry: [
          {
            id: "page-123",
            messaging: [
              { delivery: { watermark: 123456 } },
              { read: { watermark: 123456 } },
            ],
          },
        ],
      };

      const result = await service.handleWebhookPayload(payload);
      expect(result).toEqual({ success: true });
      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
    });
  });

  describe("sendReply", () => {
    const validConv = {
      id: "conv-1",
      platform: "FACEBOOK",
      platformUserId: "psid-123",
    };

    const validCustMessage = {
      id: "msg-cust",
      conversationId: "conv-1",
      sender: "CUSTOMER",
      createdAt: new Date(),
    };

    it("should throw NotFoundException if conversation does not exist", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(null);
      await expect(
        service.sendReply("nonexistent", "Hello"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if platform is not FACEBOOK or INSTAGRAM", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue({
        ...validConv,
        platform: "WHATSAPP",
      });
      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw 400 if no customer message exists in the conversation", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(null);

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(
        new BadRequestException(
          "The 24-hour reply window has expired. You can only reply within 24 hours of the customer's last message.",
        ),
      );
    });

    it("should throw 400 if latest customer message is older than 24 hours", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      prisma.metaMessage.findFirst.mockResolvedValue({
        ...validCustMessage,
        createdAt: oldDate,
      });

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(
        new BadRequestException(
          "The 24-hour reply window has expired. You can only reply within 24 hours of the customer's last message.",
        ),
      );
    });

    it("should throw 503 ServiceUnavailableException if META_PAGE_ACCESS_TOKEN is missing", async () => {
      delete process.env.META_PAGE_ACCESS_TOKEN;
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("should successfully send reply via Graph API, store message, update conversation, and audit log", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      const mockMessageRecord = {
        id: "msg-admin-1",
        conversationId: "conv-1",
        sender: "ADMIN",
        text: "Hello, how can I help you?",
        rawPayload: { recipient_id: "psid-123", message_id: "mid.123" },
      };
      prisma.metaMessage.create.mockResolvedValue(mockMessageRecord);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ recipient_id: "psid-123", message_id: "mid.123" }),
      } as any);

      const result = await service.sendReply(
        "conv-1",
        "Hello, how can I help you?",
        "admin-user-1",
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v21.0/me/messages",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-page-access-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: "psid-123" },
            messaging_type: "RESPONSE",
            message: { text: "Hello, how can I help you?" },
          }),
        }),
      );

      expect(prisma.metaMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: "conv-1",
          sender: "ADMIN",
          text: "Hello, how can I help you?",
          rawPayload: { recipient_id: "psid-123", message_id: "mid.123" },
        },
      });

      expect(prisma.metaConversation.update).toHaveBeenCalledWith({
        where: { id: "conv-1" },
        data: {
          lastMessageText: "Hello, how can I help you?",
          lastMessageAt: expect.any(Date),
        },
      });

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "meta.message.send",
        entityType: "MetaConversation",
        entityId: "conv-1",
        changes: { textLength: 26 },
      });

      expect(result).toEqual(mockMessageRecord);
    });

    it("should map Graph API error code 190 to 502 BadGatewayException and store NOTHING on failure", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Invalid OAuth access token.",
            type: "OAuthException",
            code: 190,
          },
        }),
      } as any);

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(
        new BadGatewayException(
          "Meta token needs renewal. Please update the META_PAGE_ACCESS_TOKEN.",
        ),
      );

      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
      expect(prisma.metaConversation.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should map Graph API policy errors (codes 10, 551, subcode 2018278) to 400 BadRequestException and store NOTHING", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Message failed due to policy",
            code: 10,
          },
        }),
      } as any);

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
    });

    it("should map Graph API rate limit error codes (4, 17, 32, 613) to 429 TOO_MANY_REQUESTS and store NOTHING", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Application request limit reached",
            code: 4,
          },
        }),
      } as any);

      try {
        await service.sendReply("conv-1", "Hello");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
    });

    it("should map unhandled Graph API errors to 502 BadGatewayException and store NOTHING", async () => {
      prisma.metaConversation.findUnique.mockResolvedValue(validConv);
      prisma.metaMessage.findFirst.mockResolvedValue(validCustMessage);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: "Internal server error",
            code: 999,
          },
        }),
      } as any);

      await expect(
        service.sendReply("conv-1", "Hello"),
      ).rejects.toThrow(BadGatewayException);

      expect(prisma.metaMessage.create).not.toHaveBeenCalled();
    });
  });
});
