import { OrderStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  toAddress,
  toContractPaymentMethod,
  toContractStatus,
  toOrderLines,
  toOrderRef,
  toPiasters,
  toStockChanged,
} from "./agent-events.mapper";

describe("agent events mapper", () => {
  it("converts EGP to integer piasters without float errors", () => {
    expect(toPiasters(new Decimal("899.00"))).toBe(89900);
    expect(toPiasters("0.1")).toBe(10);
    expect(toPiasters(new Decimal("19.995"))).toBe(2000);
    expect(toPiasters(null)).toBe(0);
  });

  it.each([
    [OrderStatus.PENDING, PaymentMethod.COD, "AWAITING_CONFIRMATION"],
    [OrderStatus.PENDING, PaymentMethod.ONLINE, "AWAITING_PAYMENT"],
    [OrderStatus.CONFIRMED, PaymentMethod.COD, "CONFIRMED"],
    [OrderStatus.PROCESSING, PaymentMethod.COD, "READY_TO_SHIP"],
    [OrderStatus.PAID, PaymentMethod.ONLINE, "PAID"],
    [OrderStatus.SHIPPED, PaymentMethod.COD, "SHIPPED"],
    [OrderStatus.DELIVERED, PaymentMethod.COD, "DELIVERED"],
    [OrderStatus.REFUNDED, PaymentMethod.ONLINE, "REFUNDED"],
    [OrderStatus.CANCELLED, PaymentMethod.COD, "CANCELLED"],
    [OrderStatus.EXPIRED, PaymentMethod.ONLINE, "CANCELLED"],
  ])("maps %s/%s to %s", (status, method, expected) => {
    expect(toContractStatus(status, method)).toBe(expected);
  });

  it("maps payment methods", () => {
    expect(toContractPaymentMethod(PaymentMethod.COD)).toBe("COD");
    expect(toContractPaymentMethod(PaymentMethod.ONLINE)).toBe("CARD");
  });

  it("builds OrderRef, lines, address and stock payloads", () => {
    const ref = toOrderRef({
      id: "o1",
      orderNumber: "RIV-1",
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.COD,
      totalAmount: new Decimal("1049.50"),
      userId: null,
      shippingPhone: "01000000000",
    });
    expect(ref).toEqual({
      order_id: "o1",
      order_number: "RIV-1",
      status: "AWAITING_CONFIRMATION",
      backend_status: "PENDING",
      customer_id: null,
      phone: "01000000000",
      channel: "website",
      payment_method: "COD",
      total_piasters: 104950,
    });

    const [line] = toOrderLines([
      {
        quantity: 2,
        unitPrice: new Decimal("300"),
        totalPrice: new Decimal("600"),
        productVariant: {
          id: "v1",
          sku: "RV-1-M",
          size: "M",
          colorHex: "#000000",
          productId: "p1",
          product: { name: "Robe" },
        },
      },
    ]);
    expect(line).toMatchObject({
      sku: "RV-1-M",
      qty: 2,
      unit_price_piasters: 30000,
      line_total_piasters: 60000,
      name: "Robe",
    });

    expect(toAddress({ shippingCity: "Cairo", shippingAddress: "St 1" })).toMatchObject({
      governorate: "Cairo",
      line1: "St 1",
    });

    expect(
      toStockChanged({ id: "v1", sku: "S", stock: 4, productId: "p1" }, -2, "sale", "RIV-1"),
    ).toEqual({
      sku: "S",
      product_id: "p1",
      variant_id: "v1",
      on_hand: 4,
      reserved: 0,
      available: 4,
      delta: -2,
      reason: "sale",
      order_number: "RIV-1",
    });
  });
});
