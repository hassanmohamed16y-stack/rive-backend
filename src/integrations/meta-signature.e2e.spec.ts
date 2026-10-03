import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as crypto from "crypto";
import request from "supertest";
import { configureApp } from "../app.config";
import { MetaController } from "./meta.controller";
import { MetaService } from "./meta.service";
import { WhatsAppController } from "../notifications/whatsapp.controller";
import { WhatsAppService } from "../notifications/whatsapp.service";

describe("Meta and WhatsApp Webhook Signature Verification (HTTP Integration)", () => {
  let app: INestApplication;
  const originalEnv = process.env;

  const mockMetaService = {
    verifyWebhookChallenge: jest.fn((mode, token, challenge) => {
      if (mode === "subscribe" && token === "test_token") {
        return challenge;
      }
      return "challenge_failed";
    }),
    handleWebhookPayload: jest.fn().mockResolvedValue({ status: "success" }),
  };

  const mockWhatsAppService = {
    verifyWebhookChallenge: jest.fn((mode, token, challenge) => {
      if (mode === "subscribe" && token === "test_token") {
        return challenge;
      }
      return "challenge_failed";
    }),
    handleWebhookPayload: jest.fn().mockResolvedValue({ status: "success" }),
  };

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      META_APP_SECRET: "test_meta_app_secret_123",
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MetaController, WhatsAppController],
      providers: [
        { provide: MetaService, useValue: mockMetaService },
        { provide: WhatsAppService, useValue: mockWhatsAppService },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false, rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (app) {
      await app.close();
    }
  });

  function signPayload(payload: string, secret: string): string {
    return (
      "sha256=" +
      crypto
        .createHmac("sha256", secret)
        .update(Buffer.from(payload, "utf8"))
        .digest("hex")
    );
  }

  describe("Meta Webhook Routes", () => {
    it("GET challenge verification still works without signature header", async () => {
      const res = await request(app.getHttpServer())
        .get(
          "/api/v1/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=challenge_12345",
        )
        .expect(200);

      expect(res.text).toBe("challenge_12345");
      expect(mockMetaService.verifyWebhookChallenge).toHaveBeenCalledWith(
        "subscribe",
        "test_token",
        "challenge_12345",
      );
    });

    it("POST webhook succeeds when signature is valid", async () => {
      const payload = JSON.stringify({
        object: "page",
        entry: [{ id: "meta_1" }],
      });
      const signature = signPayload(payload, "test_meta_app_secret_123");

      await request(app.getHttpServer())
        .post("/api/v1/integrations/meta/webhook")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signature)
        .send(payload)
        .expect(200);

      expect(mockMetaService.handleWebhookPayload).toHaveBeenCalled();
    });

    it("POST webhook rejects with 401 when signature header is missing", async () => {
      const payload = JSON.stringify({ object: "page", entry: [] });

      await request(app.getHttpServer())
        .post("/api/v1/integrations/meta/webhook")
        .set("Content-Type", "application/json")
        .send(payload)
        .expect(401);
    });

    it("POST webhook rejects with 401 when signature is invalid", async () => {
      const payload = JSON.stringify({ object: "page", entry: [] });
      const wrongSignature = signPayload(payload, "wrong_secret");

      await request(app.getHttpServer())
        .post("/api/v1/integrations/meta/webhook")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", wrongSignature)
        .send(payload)
        .expect(401);
    });

    it("POST webhook rejects with 401 on body tampering after signing", async () => {
      const originalPayload = JSON.stringify({
        object: "page",
        entry: [{ id: "meta_1" }],
      });
      const tamperedPayload = JSON.stringify({
        object: "page",
        entry: [{ id: "meta_2" }],
      });
      const signatureForOriginal = signPayload(
        originalPayload,
        "test_meta_app_secret_123",
      );

      await request(app.getHttpServer())
        .post("/api/v1/integrations/meta/webhook")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signatureForOriginal)
        .send(tamperedPayload)
        .expect(401);
    });
  });

  describe("WhatsApp Webhook Routes", () => {
    it("GET challenge verification still works without signature header", async () => {
      const res = await request(app.getHttpServer())
        .get(
          "/api/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=challenge_67890",
        )
        .expect(200);

      expect(res.text).toBe("challenge_67890");
      expect(mockWhatsAppService.verifyWebhookChallenge).toHaveBeenCalledWith(
        "subscribe",
        "test_token",
        "challenge_67890",
      );
    });

    it("POST webhook succeeds when signature is valid", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ id: "wa_1" }],
      });
      const signature = signPayload(payload, "test_meta_app_secret_123");

      await request(app.getHttpServer())
        .post("/api/v1/integrations/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signature)
        .send(payload)
        .expect(200);

      expect(mockWhatsAppService.handleWebhookPayload).toHaveBeenCalled();
    });

    it("POST webhook rejects with 401 when signature header is missing", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      });

      await request(app.getHttpServer())
        .post("/api/v1/integrations/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .send(payload)
        .expect(401);
    });

    it("POST webhook rejects with 401 when signature is invalid", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      });
      const wrongSignature = signPayload(payload, "wrong_secret");

      await request(app.getHttpServer())
        .post("/api/v1/integrations/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", wrongSignature)
        .send(payload)
        .expect(401);
    });
  });
});
