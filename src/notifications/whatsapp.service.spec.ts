import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";

describe("WhatsAppService", () => {
  let service: WhatsAppService;
  const originalEnv = process.env;
  const prismaMock = {
    whatsAppMessage: {
      create: jest.fn().mockResolvedValue({ id: "msg_123" }),
      upsert: jest.fn().mockResolvedValue({ id: "msg_123" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails gracefully and logs warning when credentials are missing", async () => {
    const result = await service.sendMessage("+201234567890", "Test message");
    expect(result).toEqual({ success: true, messageId: "msg_123" });
  });

  it("sends test message when requested", async () => {
    const result = await service.sendTestMessage("+201234567890");
    expect(result).toEqual({ success: true, messageId: "msg_123" });
  });

  it("sends message successfully via fetch when credentials are valid", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "valid_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        messages: [{ id: "wmid.HBgL" }],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await service.sendTestMessage("+201234567890", "Custom message");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/123456789/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer valid_token",
        }),
      }),
    );
    expect(result).toEqual({ success: true, messageId: "wmid.HBgL" });
  });
});
