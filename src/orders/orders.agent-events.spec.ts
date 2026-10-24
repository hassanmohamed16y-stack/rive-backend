import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { OrdersService } from "./orders.service";

/** Orders → AI agent events are written inside the same transaction. */
describe("OrdersService agent events", () => {
  const baseOrder = {
    id: "o1",
    orderNumber: "RIV-1",
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    totalAmount: new Decimal("500"),
    couponId: null,
    items: [
      {
        productVariantId: "v1",
        quantity: 2,
        unitPrice: new Decimal("250"),
        totalPrice: new Decimal("500"),
        productVariant: { id: "v1", sku: "S1", productId: "p1", product: { name: "Robe" } },
      },
    ],
  };

  function setup() {
    let current: any = { ...baseOrder };
    const tx: any = {
      order: {
        findUnique: jest.fn(async () => current),
        findUniqueOrThrow: jest.fn(async () => current),
        updateMany: jest.fn(async ({ data }: any) => {
          current = { ...current, ...data };
          return { count: 1 };
        }),
        update: jest.fn(async ({ data }: any) => {
          current = { ...current, ...data };
          return current;
        }),
      },
      orderItem: { findMany: jest.fn(async () => baseOrder.items) },
      productVariant: {
        update: jest.fn(async () => ({})),
        findMany: jest.fn(async () => [{ id: "v1", sku: "S1", stock: 7, productId: "p1" }]),
      },
      coupon: { updateMany: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const agentEvents = {
      enqueueInTx: jest.fn().mockResolvedValue("evt"),
      kick: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn() };
    const service = new OrdersService(prisma, audit as any, undefined, agentEvents as any);
    return { service, agentEvents };
  }

  const types = (m: jest.Mock) => m.mock.calls.map((c) => c[1]);

  it("admin confirmation records order.status_changed with contract statuses", async () => {
    const { service, agentEvents } = setup();
    await service.transitionStatus("o1", OrderStatus.CONFIRMED, "admin1");
    expect(types(agentEvents.enqueueInTx)).toEqual(["order.status_changed"]);
    expect(agentEvents.enqueueInTx.mock.calls[0][2]).toMatchObject({
      from: "AWAITING_CONFIRMATION",
      to: "CONFIRMED",
      actor: "admin",
    });
    expect(agentEvents.kick).toHaveBeenCalled();
  });

  it("customer cancellation records status_changed, cancelled and the restock", async () => {
    const { service, agentEvents } = setup();
    await service.cancelByOrderNumber("RIV-1");
    expect(types(agentEvents.enqueueInTx)).toEqual([
      "order.status_changed",
      "order.cancelled",
      "stock.changed",
    ]);
    expect(agentEvents.enqueueInTx.mock.calls[1][2]).toMatchObject({
      actor: "customer",
      was_paid: false,
    });
    expect(agentEvents.enqueueInTx.mock.calls[2][2]).toMatchObject({
      sku: "S1",
      delta: 2,
      reason: "cancel",
      available: 7,
    });
  });

  it("works exactly as before when the agent module is absent", async () => {
    const tx: any = {
      order: {
        findUnique: jest.fn(async () => baseOrder),
        findUniqueOrThrow: jest.fn(async () => ({ ...baseOrder, status: "CONFIRMED" })),
        update: jest.fn(async () => ({ ...baseOrder, status: "CONFIRMED" })),
      },
    };
    const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const service = new OrdersService(prisma, { record: jest.fn() } as any);
    await expect(
      service.transitionStatus("o1", OrderStatus.CONFIRMED, "admin1"),
    ).resolves.toMatchObject({ status: "CONFIRMED" });
  });
});
