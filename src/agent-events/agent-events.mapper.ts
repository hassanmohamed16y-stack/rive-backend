import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Converts backend models into the shapes defined in EVENTS_CONTRACT.md §3.
 * Money is always integer piasters (EGP × 100); no floats leave the backend.
 */

export type ContractStatus =
  | "AWAITING_PAYMENT"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "READY_TO_SHIP"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export function toPiasters(
  value: Decimal | Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  return new Decimal(value.toString()).times(100).toDecimalPlaces(0).toNumber();
}

/** Backend statuses → the canonical agent statuses (contract §3). */
export function toContractStatus(
  status: OrderStatus,
  paymentMethod: PaymentMethod,
): ContractStatus {
  switch (status) {
    case OrderStatus.PENDING:
      return paymentMethod === PaymentMethod.COD
        ? "AWAITING_CONFIRMATION"
        : "AWAITING_PAYMENT";
    case OrderStatus.CONFIRMED:
      return "CONFIRMED";
    case OrderStatus.PROCESSING:
      return "READY_TO_SHIP";
    case OrderStatus.PAID:
      return "PAID";
    case OrderStatus.SHIPPED:
      return "SHIPPED";
    case OrderStatus.DELIVERED:
      return "DELIVERED";
    case OrderStatus.REFUNDED:
      return "REFUNDED";
    case OrderStatus.CANCELLED:
    case OrderStatus.EXPIRED:
    default:
      return "CANCELLED";
  }
}

export function toContractPaymentMethod(method: PaymentMethod): "CARD" | "COD" {
  return method === PaymentMethod.COD ? "COD" : "CARD";
}

type OrderLike = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: Decimal | Prisma.Decimal | number | string;
  userId?: string | null;
  shippingPhone?: string | null;
};

export function toOrderRef(order: OrderLike) {
  return {
    order_id: order.id,
    order_number: order.orderNumber,
    status: toContractStatus(order.status, order.paymentMethod),
    backend_status: order.status,
    customer_id: order.userId ?? null,
    phone: order.shippingPhone ?? null,
    channel: "website",
    payment_method: toContractPaymentMethod(order.paymentMethod),
    total_piasters: toPiasters(order.totalAmount),
  };
}

type OrderItemLike = {
  quantity: number;
  unitPrice: Decimal | Prisma.Decimal | number | string;
  totalPrice: Decimal | Prisma.Decimal | number | string;
  productVariant?: {
    id: string;
    sku: string;
    size?: string | null;
    colorHex?: string | null;
    productId: string;
    product?: { name?: string | null } | null;
  } | null;
};

export function toOrderLines(items: OrderItemLike[] | undefined) {
  return (items ?? []).map((item) => ({
    sku: item.productVariant?.sku ?? null,
    product_id: item.productVariant?.productId ?? null,
    variant_id: item.productVariant?.id ?? null,
    name: item.productVariant?.product?.name ?? null,
    size: item.productVariant?.size ?? null,
    color: item.productVariant?.colorHex ?? null,
    qty: item.quantity,
    unit_price_piasters: toPiasters(item.unitPrice),
    line_total_piasters: toPiasters(item.totalPrice),
  }));
}

type AddressLike = {
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  shippingZipCode?: string | null;
};

/** The checkout stores one city field; it is sent raw and the agent normalises it (P1-11). */
export function toAddress(order: AddressLike) {
  return {
    governorate: order.shippingCity ?? null,
    city: order.shippingCity ?? null,
    line1: order.shippingAddress ?? null,
    country: order.shippingCountry ?? null,
    zip: order.shippingZipCode ?? null,
  };
}

type VariantStockLike = {
  id: string;
  sku: string;
  stock: number;
  productId: string;
};

/**
 * stock.changed payload. The backend deducts stock when an order is placed
 * (the reservation is the deduction), so `on_hand` and `available` are the
 * same number and `reserved` is 0.
 */
export function toStockChanged(
  variant: VariantStockLike,
  delta: number,
  reason: "sale" | "cancel" | "restock" | "manual" | "return",
  orderNumber?: string,
) {
  return {
    sku: variant.sku,
    product_id: variant.productId,
    variant_id: variant.id,
    on_hand: variant.stock,
    reserved: 0,
    available: variant.stock,
    delta,
    reason,
    ...(orderNumber ? { order_number: orderNumber } : {}),
  };
}
