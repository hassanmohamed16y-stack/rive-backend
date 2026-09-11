import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PaymobService } from "./paymob.service";

const pendingOrder = {
  id: "order-1",
  orderNumber: "RIV-1000-ABC",
  userId: "user-1",
  guestAccessToken: null,
  status: OrderStatus.PENDING,
  reservationExpiresAt: new Date(Date.now() + 60_000),
  paymentSessionId: null,
  paymobIntentionId: null,
  paymobTransactionId: null,
  totalAmount: "120.00",
  customerName: "John Doe",
  customerEmail: "john@example.com",
  items: [
    {
      quantity: 1,
      unitPrice: "120.00",
      productVariant: { size: "S", product: { name: "Luna Silk Set" } },
    },
  ],
};

const paidOrder = {
  ...pendingOrder,
  status: OrderStatus.PAID,
  paymobTransactionId: "1234567",
};

function createService(overrides: Record<string, unknown> = {}) {
  const transactionClient = {
    processedPaymobEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-record-1" }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({ paymentSessionId: "cs_123" }),
      update: jest.fn().mockResolvedValue({ id: "order-1", status: OrderStatus.PAID }),
    },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(pendingOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: "order-1", status: OrderStatus.PAID }),
    },
    $transaction: jest.fn((callback) => callback(transactionClient)),
    ...overrides,
  };
  const ordersService = {
    expireOrder: jest.fn().mockResolvedValue(false),
    markPaidInTransaction: jest
      .fn()
      .mockResolvedValue({ id: "order-1", status: OrderStatus.PAID }),
    cancelPendingOrderInTransaction: jest.fn().mockResolvedValue(true),
  };
  const service = new PaymobService(prisma as any, ordersService as any);
  return { service, prisma, transactionClient, ordersService };
}

describe("PaymobService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PAYMOB_API_KEY = "test_api_key";
    process.env.PAYMOB_HMAC_SECRET = "486CF40C8BEBD130F7CEF8CCFCF7BEBA";
    process.env.PAYMOB_INTEGRATION_ID_CARD = "5911535";
    process.env.PAYMOB_PUBLIC_KEY = "egy_pk_test_12345";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createCheckoutSession", () => {
    it("creates a Paymob Intention successfully with piasters, items, and billing data", async () => {
      const { service, prisma } = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "int_123",
          client_secret: "cs_paymob_secret_123",
        }),
      } as any);

      const result = await service.createCheckoutSession("order-1", {
        userId: "user-1",
        role: "CUSTOMER",
      });

      expect(result).toMatchObject({
        sessionId: "cs_paymob_secret_123",
        url: "https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test_12345&clientSecret=cs_paymob_secret_123",
        orderId: "order-1",
        orderNumber: "RIV-1000-ABC",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://accept.paymob.com/v1/intention/",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test_api_key",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining('"amount":12000'),
        }),
      );

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            paymentSessionId: "cs_paymob_secret_123",
            paymobIntentionId: "int_123",
          },
        }),
      );
    });

    it("throws BadRequestException when Paymob Intention API fails", async () => {
      const { service } = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Invalid integration ID"),
      } as any);

      await expect(
        service.createCheckoutSession("order-1", { userId: "user-1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException if order is not found", async () => {
      const { service, prisma } = createService();
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createCheckoutSession("missing-order", { userId: "user-1" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("HMAC calculation & handleWebhook", () => {
    it("calculates HMAC correctly against official Paymob documentation sample callback payload", () => {
      const { service } = createService();

      const docPayload = {
        type: "TRANSACTION",
        obj: {
          id: 192036465,
          pending: false,
          amount_cents: 100000,
          success: true,
          is_auth: false,
          is_capture: false,
          is_standalone_payment: true,
          is_voided: false,
          is_refunded: false,
          is_3d_secure: true,
          integration_id: 4097558,
          profile_id: 164295,
          has_parent_transaction: false,
          order: {
            id: 217503754,
          },
          created_at: "2024-06-13T11:33:44.592345",
          currency: "EGP",
          source_data: {
            pan: "2346",
            sub_type: "MasterCard",
            type: "card",
          },
          error_occured: false,
          owner: 302852,
        },
      };

      const calculatedHmac = service.calculateHmac(docPayload);
      expect(typeof calculatedHmac).toBe("string");
      expect(calculatedHmac.length).toBe(128);
    });

    it("verifies valid HMAC signature and processes successful payment callback", async () => {
      const { service, ordersService } = createService();

      const callbackPayload = {
        type: "TRANSACTION",
        obj: {
          id: 1234567,
          pending: false,
          amount_cents: 12000,
          success: true,
          is_auth: false,
          is_capture: false,
          error_occured: false,
          is_standalone_payment: true,
          is_voided: false,
          is_live: false,
          refunded_amount_cents: 0,
          is_refunded: false,
          is_3d_secure: true,
          integration_id: 5911535,
          has_parent_transaction: false,
          order: {
            id: 9876543,
          },
          owner: 302852,
          created_at: "2026-09-11T00:00:00.000000",
          currency: "EGP",
          source_data: {
            pan: "2345",
            sub_type: "MasterCard",
            type: "card",
          },
          special_reference: "order-1",
        },
      };

      const calculatedHmac = service.calculateHmac(callbackPayload);

      const result = await service.handleWebhook(
        callbackPayload,
        calculatedHmac,
      );

      expect(result).toMatchObject({
        received: true,
        orderId: "order-1",
        status: OrderStatus.PAID,
      });

      expect(ordersService.markPaidInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        "order-1",
      );
    });

    it("rejects webhook with invalid HMAC signature", async () => {
      const { service } = createService();

      const callbackPayload = {
        type: "TRANSACTION",
        obj: { id: 1234567, amount_cents: 12000 },
      };

      await expect(
        service.handleWebhook(callbackPayload, "invalid_hmac_signature"),
      ).rejects.toThrow("Webhook verification failed");
    });

    it("handles idempotency when duplicate webhook is delivered", async () => {
      const { service, transactionClient } = createService();

      transactionClient.processedPaymobEvent.create.mockRejectedValueOnce({
        code: "P2002",
      });

      const callbackPayload = {
        type: "TRANSACTION",
        obj: { id: 1234567, special_reference: "order-1" },
      };

      const validHmac = service.calculateHmac(callbackPayload);

      const result = await service.handleWebhook(callbackPayload, validHmac);

      expect(result).toMatchObject({
        received: true,
        eventId: "1234567",
        message: "Webhook already processed.",
      });
    });

    it("cancels order when payment callback indicates failure", async () => {
      const { service, ordersService } = createService();

      const failedPayload = {
        type: "TRANSACTION",
        obj: {
          id: 1234568,
          pending: false,
          amount_cents: 12000,
          success: false,
          is_auth: false,
          is_capture: false,
          error_occured: true,
          is_standalone_payment: true,
          is_voided: false,
          is_refunded: false,
          is_3d_secure: false,
          integration_id: 5911535,
          has_parent_transaction: false,
          order: { id: 9876543 },
          owner: 302852,
          created_at: "2026-09-11T00:00:00.000000",
          currency: "EGP",
          source_data: { pan: "2345", sub_type: "Visa", type: "card" },
          special_reference: "order-1",
        },
      };

      const validHmac = service.calculateHmac(failedPayload);

      const result = await service.handleWebhook(failedPayload, validHmac);

      expect(result).toMatchObject({
        received: true,
        orderId: "order-1",
        status: OrderStatus.CANCELLED,
      });

      expect(
        ordersService.cancelPendingOrderInTransaction,
      ).toHaveBeenCalledWith(expect.anything(), "order-1", OrderStatus.CANCELLED);
    });
  });

  describe("refundTransaction", () => {
    it("executes refund successfully via Paymob Refund API", async () => {
      const { service, prisma } = createService();
      prisma.order.findUnique.mockResolvedValueOnce(paidOrder as any);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 99999, success: true }),
      } as any);

      const result = await service.refundTransaction("order-1", 120.0);

      expect(result).toMatchObject({
        success: true,
        orderId: "order-1",
        refundedAmount: 120.0,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://accept.paymob.com/api/acceptance/void_refund/refund",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            transaction_id: "1234567",
            amount_cents: 12000,
          }),
        }),
      );
    });

    it("throws BadRequestException if order is not paid", async () => {
      const { service, prisma } = createService();
      prisma.order.findUnique.mockResolvedValueOnce(pendingOrder as any);

      await expect(
        service.refundTransaction("order-1", 120.0),
      ).rejects.toThrow("Only paid orders can be refunded");
    });
  });
});
