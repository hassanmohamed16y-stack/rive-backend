import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
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
      findMany: jest.fn().mockResolvedValue([{ id: "msg_123", rawPayload: { old: "data" } }]),
      update: jest.fn().mockResolvedValue({ id: "msg_123" }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it("throws ServiceUnavailableException (503) when sendMessage is called without credentials", async () => {
    await expect(
      service.sendMessage("+201234567890", "Test message"),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("throws ServiceUnavailableException (503) when test message is requested without credentials", async () => {
    await expect(service.sendTestMessage("+201234567890")).rejects.toThrow(
      ServiceUnavailableException,
    );
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

  it("maps Graph API error code 190 to BadGatewayException (502) and stores only code/status", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "valid_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ error: { code: 190, message: "Invalid OAuth access token." } }),
      ),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(
      service.sendMessage("+201234567890", "Test message"),
    ).rejects.toThrow(BadGatewayException);

    expect(prismaMock.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "FAILED",
        rawPayload: { code: 190, status: 400 },
      }),
    });
  });

  it("maps Graph API error code 131047 to BadRequestException (400)", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "valid_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ error: { code: 131047, message: "Re-engagement message needed" } }),
      ),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(
      service.sendMessage("+201234567890", "Test message"),
    ).rejects.toThrow(BadRequestException);
  });

  it("maps Graph API rate limit codes (e.g. 130429) to 429 HttpException", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "valid_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({ error: { code: 130429, message: "Rate limit hit" } }),
      ),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    let thrownError: any;
    try {
      await service.sendMessage("+201234567890", "Test message");
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(HttpException);
    expect(thrownError.getStatus()).toBe(429);
  });

  it("handles webhook status update for failed messages storing error code and title", async () => {
    const webhookPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wmid.123",
                    status: "failed",
                    errors: [{ code: 131026, title: "Undeliverable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await service.handleWebhookPayload(webhookPayload);
    expect(res).toEqual({ success: true });
    expect(prismaMock.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: "msg_123" },
      data: {
        status: "FAILED",
        rawPayload: { old: "data", error: { code: 131026, title: "Undeliverable" } },
      },
    });
  });
});
