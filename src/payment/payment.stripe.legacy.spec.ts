import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PaymentService } from "./payment.service";

const pendingOrder = {
  id: "order-1",
  orderNumber: "RIV-1000-ABC",
  userId: "user-1",
  guestAccessToken: null,
  status: OrderStatus.PENDING,
  reservationExpiresAt: new Date(Date.now() + 60_000),
  paymentSessionId: null,
  items: [
    {
      quantity: 1,
      unitPrice: "120.00",
      productVariant: { size: "S", product: { name: "Luna Silk Set" } },
    },
  ],
};

function createService(overrides: Record<string, unknown> = {}) {
  const transactionClient = {
    processedStripeEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-record-1" }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({ paymentSessionId: "cs_123" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(pendingOrder),
      update: jest.fn().mockResolvedValue({ id: "order-1", paymentSessionId: "cs_123" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
  const service = new PaymentService(prisma as any, ordersService as any);
  return { service, prisma, transactionClient, ordersService };
}

function verifiedEvent(type: string, paymentStatus = "paid") {
  return {
    id: "evt_123",
    type,
    data: {
      object: {
        id: "cs_123",
        metadata: { orderId: "order-1", orderNumber: "RIV-1000-ABC" },
        payment_status: paymentStatus,
      },
    },
  };
}

describe("Stripe PaymentService Checkout and webhook security", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("creates a Checkout Session with server prices, metadata, and a stable idempotency key", async () => {
    const { service, prisma } = createService();
    const create = jest
      .fn()
      .mockResolvedValue({
        id: "cs_123",
        url: "https://checkout.stripe.test/cs_123",
      });
    (service as any).stripe = { checkout: { sessions: { create } } };

    await expect(
      service.createCheckoutSession("order-1", {
        userId: "user-1",
        role: "CUSTOMER",
      }),
    ).resolves.toMatchObject({ sessionId: "cs_123" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { orderId: "order-1", orderNumber: "RIV-1000-ABC" },
        payment_intent_data: {
          metadata: { orderId: "order-1", orderNumber: "RIV-1000-ABC" },
        },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 12000 }),
          }),
        ],
      }),
      { idempotencyKey: "checkout-session:order-1" },
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { paymentSessionId: "cs_123" },
      }),
    );
  });

  it("reuses an open Checkout Session instead of creating another one", async () => {
    const { service } = createService({
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            ...pendingOrder,
            paymentSessionId: "cs_existing",
          }),
      },
    });
    const retrieve = jest
      .fn()
      .mockResolvedValue({
        id: "cs_existing",
        status: "open",
        url: "https://checkout.stripe.test/existing",
      });
    const create = jest.fn();
    (service as any).stripe = { checkout: { sessions: { retrieve, create } } };

    await expect(
      service.createCheckoutSession("order-1", {
        userId: "user-1",
        role: "CUSTOMER",
      }),
    ).resolves.toMatchObject({ sessionId: "cs_existing" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an invalid order when checkout session target does not exist", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createCheckoutSession("missing", { userId: "user-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects all Stripe webhooks with BadRequestException indicating gateway is disabled", async () => {
    const { service } = createService();
    await expect(
      service.handleWebhook(Buffer.from("{}"), "invalid_sig"),
    ).rejects.toThrow("Stripe payment gateway is disabled");
  });
});
