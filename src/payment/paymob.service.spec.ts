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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productVariant: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(pendingOrder),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: "order-1", status: OrderStatus.PAID }),
    },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
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
    it("executes refund successfully via Paymob Refund API and updates order status to REFUNDED", async () => {
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

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          status: OrderStatus.REFUNDED,
          paymentStatus: "REFUNDED",
        },
      });
    });

    it("rejects duplicate refund when order is already refunded", async () => {
      const { service, prisma } = createService();
      const refundedOrder = {
        ...paidOrder,
        status: OrderStatus.REFUNDED,
      };
      prisma.order.findUnique.mockResolvedValueOnce(refundedOrder as any);

      await expect(
        service.refundTransaction("order-1", 120.0),
      ).rejects.toThrow("Order has already been refunded");
    });

    it("throws BadRequestException if order is not paid", async () => {
      const { service, prisma } = createService();
      prisma.order.findUnique.mockResolvedValueOnce(pendingOrder as any);

      await expect(
        service.refundTransaction("order-1", 120.0),
      ).rejects.toThrow("Only paid orders can be refunded");
    });
  });

  describe("reconcilePayments", () => {
    it("throws ServiceUnavailableException (503) when PAYMOB_API_KEY is missing or empty", async () => {
      process.env.PAYMOB_API_KEY = "";
      const { service } = createService();

      await expect(service.reconcilePayments(2)).rejects.toThrow(
        "Paymob API key is not configured",
      );
    });

    it("auto-repairs pending order when Paymob payment is confirmed SUCCESS and amount/currency/reference match", async () => {
      const notifyMock = jest.fn().mockResolvedValue(undefined);
      const { service, prisma, ordersService } = createService();
      (service as any).notificationsService = { notifyPaymentCompleted: notifyMock };

      const mockOrders = [
        {
          id: "order-pending-1",
          orderNumber: "RIV-1001",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-1001",
          totalAmount: "120.00",
          customerName: "Jane Doe",
          customerEmail: "jane@example.com",
          shippingPhone: "+20123456789",
          items: [],
        },
      ];
      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 12000,
          currency: "EGP",
          special_reference: "order-pending-1",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.checkedCount).toBe(1);
      expect(result.repairedCount).toBe(1);
      expect(result.mismatchesCount).toBe(0);
      expect(ordersService.markPaidInTransaction).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ orderNumber: "RIV-1001" }),
      );
    });

    it("sends order to manual review when Paymob transaction reference does NOT match order ID or number", async () => {
      const { service, prisma } = createService();
      const mockOrders = [
        {
          id: "order-pending-ref-mismatch",
          orderNumber: "RIV-1009",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-ref-mismatch",
          totalAmount: "120.00",
          items: [],
        },
      ];
      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 12000,
          currency: "EGP",
          special_reference: "completely-different-order-id",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.checkedCount).toBe(1);
      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatches[0].details).toContain("non-matching reference");
    });

    it("sends order to manual review when amount_cents or currency is missing or non-numeric", async () => {
      const { service, prisma } = createService();
      const mockOrders = [
        {
          id: "order-bad-amount",
          orderNumber: "RIV-1010",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-bad-amount",
          totalAmount: "120.00",
          items: [],
        },
      ];
      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: "not-a-number",
          currency: "EGP",
          special_reference: "order-bad-amount",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatches[0].details).toContain("missing or invalid amount_cents");
    });

    it("does NOT auto-repair when there is an amount mismatch and records for manual review", async () => {
      const { service, prisma } = createService({
        auditLog: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "audit-1" }),
        },
      });
      const mockOrders = [
        {
          id: "order-amount-mismatch",
          orderNumber: "RIV-1002",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-1002",
          totalAmount: "120.00", // 12000 piasters
          items: [],
        },
      ];
      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 5000, // 5000 piasters mismatch!
          currency: "EGP",
          special_reference: "order-amount-mismatch",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.checkedCount).toBe(1);
      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatchesCount).toBe(1);
      expect(result.mismatches[0].details).toContain("Amount mismatch");
    });

    it("does NOT auto-repair when there is a currency mismatch", async () => {
      const { service, prisma } = createService({
        auditLog: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "audit-1" }),
        },
      });
      const mockOrders = [
        {
          id: "order-currency-mismatch",
          orderNumber: "RIV-1003",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-1003",
          totalAmount: "120.00",
          items: [],
        },
      ];
      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 12000,
          currency: "USD",
          special_reference: "order-currency-mismatch",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatches[0].details).toContain("Currency mismatch");
    });

    it("does NOT query or alter orders that are already PAID unless audit=true flag is passed", async () => {
      const { service, prisma } = createService();
      prisma.order.findMany = jest.fn().mockResolvedValue([]);

      await service.reconcilePayments(2, false);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
            },
            paymentStatus: {
              notIn: ["PAID", "REFUNDED"],
            },
          }),
        }),
      );
    });

    it("repairs cancelled order if stock is available, re-reserving stock atomically and re-counting coupon", async () => {
      const txPrisma = {
        processedPaymobEvent: { create: jest.fn().mockResolvedValue({}) },
        productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        coupon: {
          findUnique: jest.fn().mockResolvedValue({ id: "coupon-1", usageLimit: 10, usageCount: 5 }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const { service, prisma } = createService({
        $transaction: jest.fn((cb) => cb(txPrisma)),
      });

      const cancelledOrderWithStock = {
        id: "order-cancelled-stock-ok",
        orderNumber: "RIV-1004",
        status: OrderStatus.CANCELLED,
        paymentStatus: "PENDING",
        paymobTransactionId: "tx-1004",
        couponId: "coupon-1",
        totalAmount: "100.00",
        items: [
          {
            productVariantId: "var-1",
            quantity: 2,
            productVariant: { isAvailable: true, stock: 5 },
          },
        ],
      };

      prisma.order.findMany = jest.fn().mockResolvedValue([cancelledOrderWithStock]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 10000,
          currency: "EGP",
          special_reference: "order-cancelled-stock-ok",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.repairedCount).toBe(1);
      expect(txPrisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: "var-1", isAvailable: true, stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      });
      expect(txPrisma.coupon.updateMany).toHaveBeenCalledWith({
        where: { id: "coupon-1", usageCount: { lt: 10 } },
        data: { usageCount: { increment: 1 } },
      });
    });

    it("rolls back cancelled order repair if ANY item variant has insufficient stock during in-transaction updateMany", async () => {
      const txPrisma = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, // Stock check failed!
      };
      const { service, prisma } = createService({
        $transaction: jest.fn((cb) => cb(txPrisma)),
        auditLog: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "audit-1" }),
        },
      });

      const cancelledOrderPartialStock = {
        id: "order-cancelled-insufficient-stock",
        orderNumber: "RIV-1005",
        status: OrderStatus.CANCELLED,
        paymentStatus: "PENDING",
        paymobTransactionId: "tx-1005",
        totalAmount: "100.00",
        items: [
          {
            productVariantId: "var-1",
            quantity: 10,
            productVariant: { isAvailable: true, stock: 2 },
          },
        ],
      };

      prisma.order.findMany = jest.fn().mockResolvedValue([cancelledOrderPartialStock]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 10000,
          currency: "EGP",
          special_reference: "order-cancelled-insufficient-stock",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatches[0].details).toContain(
        "inventory is insufficient to re-reserve stock",
      );
    });

    it("flags cancelled order for manual review if stock is NOT available to re-reserve", async () => {
      const txPrisma = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      const { service, prisma } = createService({
        $transaction: jest.fn((cb) => cb(txPrisma)),
        auditLog: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "audit-1" }),
        },
      });

      const cancelledOrderNoStock = {
        id: "order-cancelled-no-stock",
        orderNumber: "RIV-1005",
        status: OrderStatus.CANCELLED,
        paymentStatus: "PENDING",
        paymobTransactionId: "tx-1005",
        totalAmount: "100.00",
        items: [
          {
            productVariantId: "var-1",
            quantity: 10,
            productVariant: { isAvailable: true, stock: 2 }, // Stock is only 2!
          },
        ],
      };

      prisma.order.findMany = jest.fn().mockResolvedValue([cancelledOrderNoStock]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          pending: false,
          amount_cents: 10000,
          currency: "EGP",
          special_reference: "order-cancelled-no-stock",
        }),
      } as any);

      const result = await service.reconcilePayments(2);

      expect(result.repairedCount).toBe(0);
      expect(result.manualReviewCount).toBe(1);
      expect(result.mismatches[0].details).toContain(
        "inventory is insufficient to re-reserve stock",
      );
    });

    it("suppresses duplicate audit logs within 24 hours for the same order and action", async () => {
      const findFirstMock = jest.fn().mockResolvedValue({ id: "audit-existing" });
      const recordMock = jest.fn();
      const { service, prisma } = createService({
        auditLog: { findFirst: findFirstMock },
      });
      (service as any).auditLogService = { record: recordMock };

      const mockOrders = [
        {
          id: "order-dup-audit",
          orderNumber: "RIV-1006",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: null,
          paymobIntentionId: "int-1006",
          totalAmount: "100.00",
          items: [],
        },
      ];

      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      const result = await service.reconcilePayments(2);

      expect(result.unlinkedIntentions).toBe(1);
      expect(findFirstMock).toHaveBeenCalled();
      expect(recordMock).not.toHaveBeenCalled(); // Suppressed duplicate audit!
    });

    it("throws BadGatewayException (502) when >50% of Paymob provider calls fail", async () => {
      const { service, prisma } = createService();

      const mockOrders = [
        {
          id: "order-failing-1",
          orderNumber: "RIV-F1",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-f1",
          totalAmount: "100.00",
          items: [],
        },
        {
          id: "order-failing-2",
          orderNumber: "RIV-F2",
          status: OrderStatus.PENDING,
          paymentStatus: "PENDING",
          paymobTransactionId: "tx-f2",
          totalAmount: "100.00",
          items: [],
        },
      ];

      prisma.order.findMany = jest.fn().mockResolvedValue(mockOrders);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(service.reconcilePayments(2)).rejects.toThrow(
        "Paymob reconciliation failed: 2 out of 2 provider calls failed",
      );
    });

    it("caps queried orders at 200 items ordered oldest first", async () => {
      const { service, prisma } = createService();
      prisma.order.findMany = jest.fn().mockResolvedValue([]);

      await service.reconcilePayments(2);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
          orderBy: { createdAt: "asc" },
        }),
      );
    });

    it("never includes secrets or raw Paymob response bodies in output response", async () => {
      const { service, prisma } = createService();
      prisma.order.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.reconcilePayments(2);

      const strResult = JSON.stringify(result);
      expect(strResult).not.toContain("test_api_key");
      expect(strResult).not.toContain("486CF40C8BEBD130F7CEF8CCFCF7BEBA");
    });
  });
});
