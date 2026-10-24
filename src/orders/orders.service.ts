import * as crypto from "crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { CouponType, OrderStatus, PaymentMethod, PaymentStatus, Prisma, ProductStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { isOrderOwnedByActor } from "../common/utils/order-ownership";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";
import {
  maskPhoneLast3,
  normalizeEgyptianPhone,
} from "../common/utils/phone-normalization";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { AgentEventsService } from "../agent-events/agent-events.service";
import {
  toAddress,
  toContractStatus,
  toOrderLines,
  toOrderRef,
  toPiasters,
  toStockChanged,
} from "../agent-events/agent-events.mapper";
import { CreateOrderDto } from "./dto/create-order.dto";
import { TrackOrderDto } from "./dto/track-order.dto";
import { UpdateOrderShippingDto } from "./dto/update-order-shipping.dto";

const RESERVATION_DURATION_MS = 30 * 60 * 1000;

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.PAID, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.REFUNDED,
  ],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
  EXPIRED: [],
};

const orderInclude = {
  items: {
    include: {
      productVariant: {
        include: {
          product: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

/** Statuses in which the order's items are still deducted from stock and not shipped. */
const ORDER_STATUSES_HOLDING_STOCK: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.PAID,
];

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orderTrackRateMap = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly agentEvents?: AgentEventsService,
  ) {}

  // ---------------------------------------------------------------------------
  // AI agent events (EVENTS_CONTRACT.md). All of these run inside the business
  // transaction, write to the outbox only, and can never fail the order.
  // ---------------------------------------------------------------------------

  private async emitStockChanges(
    tx: Prisma.TransactionClient,
    items: { productVariantId: string; quantity: number }[],
    sign: 1 | -1,
    reason: "sale" | "cancel",
    orderNumber: string,
  ) {
    if (!this.agentEvents || items.length === 0) return;
    const deltas = new Map<string, number>();
    for (const item of items) {
      deltas.set(
        item.productVariantId,
        (deltas.get(item.productVariantId) ?? 0) + sign * item.quantity,
      );
    }
    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...deltas.keys()] } },
      select: { id: true, sku: true, stock: true, productId: true },
    });
    for (const variant of variants) {
      await this.agentEvents.enqueueInTx(
        tx,
        "stock.changed",
        toStockChanged(variant, deltas.get(variant.id) ?? 0, reason, orderNumber),
      );
    }
  }

  private async emitStatusChanged(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus,
    actor: "customer" | "admin" | "system",
    reason?: string,
  ) {
    if (!this.agentEvents) return;
    const order = await this.findOrderDetailsById(tx, orderId);
    if (order.status === from) return;
    const ref = toOrderRef(order);
    await this.agentEvents.enqueueInTx(tx, "order.status_changed", {
      order: ref,
      from: toContractStatus(from, order.paymentMethod),
      to: ref.status,
      backend_from: from,
      backend_to: order.status,
      actor,
      ...(reason ? { reason } : {}),
    });

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.EXPIRED
    ) {
      await this.agentEvents.enqueueInTx(tx, "order.cancelled", {
        order: ref,
        reason_code:
          reason ??
          (order.status === OrderStatus.EXPIRED
            ? "reservation_expired"
            : `${actor}_cancelled`),
        actor,
        was_paid: order.paymentStatus === PaymentStatus.PAID,
      });
      await this.emitStockChanges(
        tx,
        order.items,
        1,
        "cancel",
        order.orderNumber,
      );
    }
  }

  private async emitOrderCreated(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
  ) {
    if (!this.agentEvents) return;
    await this.agentEvents.enqueueInTx(tx, "order.created", {
      order: toOrderRef(order),
      lines: toOrderLines(order.items),
      address: toAddress(order),
      customer_name: order.customerName ?? null,
      subtotal_piasters: toPiasters(order.subtotal),
      discount_piasters: toPiasters(order.discount),
      shipping_piasters: toPiasters(order.shippingFee),
      cod_fee_piasters: toPiasters(order.codFee),
      coupon_code: order.couponCode ?? null,
      is_gift: false,
      utm: null,
      customer_note: order.notes ?? null,
    });
    await this.emitStockChanges(tx, order.items, -1, "sale", order.orderNumber);
  }

  /** Best-effort immediate send after commit (no-op when the agent link is off). */
  private async kickAgent() {
    await this.agentEvents?.kick();
  }

  private checkOrderTrackRateLimit(orderNumber: string): void {
    const now = Date.now();
    const windowMs = 60_000;
    const maxAttempts = 3;

    const timestamps = (this.orderTrackRateMap.get(orderNumber) || []).filter(
      (ts) => now - ts < windowMs,
    );

    if (timestamps.length >= maxAttempts) {
      throw new ThrottlerException("Too Many Requests");
    }

    timestamps.push(now);
    this.orderTrackRateMap.set(orderNumber, timestamps);
  }

  async onModuleInit() {
    // Expire any reservations that lapsed while the process was offline. Ongoing expiry is
    // driven externally by POST /api/v1/internal/expire-reservations, invoked by an external cron/scheduler,
    // instead of an in-process setInterval — this avoids redundant work across instances.
    await this.expirePendingReservations().catch((error: unknown) => {
      this.logger.error(
        "Unable to expire pending order reservations",
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private async findOrderDetailsById(
    client: PrismaService | Prisma.TransactionClient,
    orderId: string,
  ) {
    return client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `RIV-${timestamp}-${random}`;
  }

  private generateGuestAccessToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private assertTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ) {
    if (
      currentStatus !== nextStatus &&
      !allowedTransitions[currentStatus].includes(nextStatus)
    ) {
      throw new ConflictException(
        `Cannot transition order from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  async create(dto: CreateOrderDto, userId?: string) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: orderInclude,
      });
      if (existing) {
        return {
          ...existing,
          guestAccessToken: existing.guestAccessToken || undefined,
        };
      }
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Order must include at least one item");
    }

    const variantIds = new Set<string>();
    for (const item of dto.items) {
      if (variantIds.has(item.productVariantId)) {
        throw new BadRequestException("Duplicate product variant in order");
      }
      variantIds.add(item.productVariantId);
    }

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.ONLINE;
    const isCod = paymentMethod === PaymentMethod.COD;

    if (!dto.shippingPhone || !dto.shippingPhone.trim()) {
      throw new BadRequestException("Shipping phone is required");
    }
    const sanitizedPhone = normalizeEgyptianPhone(dto.shippingPhone);
    if (!sanitizedPhone) {
      throw new BadRequestException("Invalid Egyptian phone number");
    }

    if (isCod) {
      if (!dto.shippingAddress || !dto.shippingAddress.trim()) {
        throw new BadRequestException("Shipping address is required for COD orders");
      }
    }

    const guestAccessToken = userId
      ? undefined
      : this.generateGuestAccessToken();
    const reservationExpiresAt = isCod
      ? null
      : new Date(Date.now() + RESERVATION_DURATION_MS);

    const order = await this.prisma.$transaction(async (tx) => {
      const siteSettings = await tx.siteSettings?.findUnique({
        where: { id: "default" },
      });

      if (isCod && siteSettings && siteSettings.codEnabled === false) {
        throw new BadRequestException("Cash on Delivery (COD) is currently disabled");
      }
      const variants = await tx.productVariant.findMany({
        where: { id: { in: [...variantIds] } },
        include: { product: true },
      });
      const variantsById = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      const orderItemsData = dto.items.map((item) => {
        const variant = variantsById.get(item.productVariantId);
        if (!variant) {
          throw new NotFoundException(
            `Product variant ${item.productVariantId} was not found`,
          );
        }
        if (
          !variant.isAvailable ||
          Boolean(variant.product.deletedAt) ||
          variant.product.status !== ProductStatus.ACTIVE
        ) {
          throw new BadRequestException(
            `Product variant ${item.productVariantId} is unavailable`,
          );
        }
        const unitPrice = new Decimal(variant.price);
        return {
          productVariantId: variant.id,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          totalPrice: unitPrice.times(item.quantity).toString(),
        };
      });

      // Atomic stock decrement within transaction: condition `stock >= item.quantity` prevents
      // race conditions and overselling when multiple concurrent orders target the same variant.
      for (const item of orderItemsData) {
        const updated = await tx.productVariant.updateMany({
          where: {
            id: item.productVariantId,
            isAvailable: true,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for variant ${item.productVariantId}`,
          );
        }
      }

      const subtotal = orderItemsData.reduce(
        (sum, item) => sum.plus(new Decimal(item.totalPrice)),
        new Decimal(0),
      );

      if (
        siteSettings?.minimumOrderAmount &&
        new Decimal(siteSettings.minimumOrderAmount).greaterThan(0)
      ) {
        const minAmount = new Decimal(siteSettings.minimumOrderAmount);
        if (subtotal.lessThan(minAmount)) {
          throw new BadRequestException(
            `Minimum order amount is ${minAmount.toString()}`,
          );
        }
      }

      let discount = new Decimal(0);
      let couponId: string | undefined;
      let couponCode: string | undefined;

      if (dto.couponCode) {
        const normalizedCode = dto.couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findUnique({
          where: { code: normalizedCode },
        });

        if (!coupon || !coupon.isActive) {
          throw new BadRequestException("Coupon is invalid or inactive");
        }

        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new BadRequestException("Coupon has expired");
        }

        if (
          coupon.minOrderAmount &&
          subtotal.lessThan(new Decimal(coupon.minOrderAmount))
        ) {
          throw new BadRequestException(
            `Minimum order amount for this coupon is ${coupon.minOrderAmount.toString()}`,
          );
        }

        if (
          coupon.usagePerCustomer !== null &&
          coupon.usagePerCustomer !== undefined &&
          userId
        ) {
          const userUsageCount = await tx.order.count({
            where: {
              userId,
              couponId: coupon.id,
              status: { notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
            },
          });
          if (userUsageCount >= coupon.usagePerCustomer) {
            throw new BadRequestException(
              "Coupon customer usage limit reached",
            );
          }
        }

        const whereClause: Prisma.CouponWhereInput = {
          id: coupon.id,
          isActive: true,
        };
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
          whereClause.usageCount = { lt: coupon.usageLimit };
        }

        const updatedCoupon = await tx.coupon.updateMany({
          where: whereClause,
          data: { usageCount: { increment: 1 } },
        });

        if (updatedCoupon.count !== 1) {
          throw new BadRequestException("Coupon usage limit reached");
        }

        couponId = coupon.id;
        couponCode = coupon.code;

        const couponVal =
          typeof coupon.value === "object" && coupon.value !== null && "toNumber" in (coupon.value as any)
            ? (coupon.value as any).toNumber()
            : Number(coupon.value);

        if (coupon.type === CouponType.PERCENTAGE) {
          discount = subtotal.times(new Decimal(couponVal)).dividedBy(100);
        } else {
          discount = Decimal.min(new Decimal(couponVal), subtotal);
        }
      }

      if (!dto.shippingCity || !dto.shippingCity.trim()) {
        throw new BadRequestException("Shipping city is required");
      }

      const shippingCityTrimmed = dto.shippingCity.trim();
      const activeZones = await tx.shippingZone.findMany({
        where: { isActive: true },
      });

      const matchingZone = activeZones.find(
        (zone) =>
          zone.cityLabel.trim().toLowerCase() ===
          shippingCityTrimmed.toLowerCase(),
      );

      if (!matchingZone) {
        throw new BadRequestException(
          `No active shipping zone found for city "${dto.shippingCity}"`,
        );
      }

      let shippingFee = new Decimal(matchingZone.price);

      if (
        siteSettings?.freeShippingThreshold &&
        new Decimal(siteSettings.freeShippingThreshold).greaterThan(0)
      ) {
        const threshold = new Decimal(siteSettings.freeShippingThreshold);
        const subtotalAfterDiscount = subtotal.minus(discount);
        if (subtotalAfterDiscount.greaterThanOrEqualTo(threshold)) {
          shippingFee = new Decimal(0);
        }
      }

      const totalBeforeCodFee = Decimal.max(
        subtotal.minus(discount).plus(shippingFee),
        new Decimal(0),
      );

      let codFee = new Decimal(0);
      if (isCod) {
        if (
          siteSettings?.codMaxAmount &&
          new Decimal(siteSettings.codMaxAmount).greaterThan(0)
        ) {
          const maxAmount = new Decimal(siteSettings.codMaxAmount);
          if (totalBeforeCodFee.greaterThan(maxAmount)) {
            throw new BadRequestException(
              `Order total exceeds maximum allowed amount for COD (${maxAmount.toString()} EGP)`,
            );
          }
        }

        if (siteSettings?.codFee) {
          codFee = new Decimal(siteSettings.codFee);
        }
      }

      const totalAmount = totalBeforeCodFee.plus(codFee);

      const created = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          idempotencyKey: dto.idempotencyKey || null,
          userId,
          guestAccessToken,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod,
          codFee: codFee.toString(),
          subtotal: subtotal.toString(),
          discount: discount.toString(),
          shippingFee: shippingFee.toString(),
          totalAmount: totalAmount.toString(),
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          shippingAddress: dto.shippingAddress,
          shippingCity: dto.shippingCity,
          shippingCountry: dto.shippingCountry,
          shippingPhone: sanitizedPhone,
          shippingZipCode: dto.shippingZipCode,
          notes: dto.notes,
          reservationExpiresAt,
          couponId,
          couponCode,
          items: { create: orderItemsData },
        },
        include: orderInclude,
      });
      await this.emitOrderCreated(tx, created);
      return created;
    }).catch(async (error) => {
      if (isPrismaErrorCode(error, "P2002") && dto.idempotencyKey) {
        const existing = await this.prisma.order.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: orderInclude,
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    });

    await this.kickAgent();

    if (order.paymentMethod === PaymentMethod.COD) {
      try {
        await this.notificationsService?.notifyOrderCreated({
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          customerName: order.customerName || undefined,
          customerEmail: order.customerEmail || undefined,
          shippingPhone: order.shippingPhone || undefined,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to send order created notification for COD order ${order.orderNumber}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      ...order,
      guestAccessToken: order.guestAccessToken || guestAccessToken,
    };
  }

  async markPaid(orderId: string, updatedById?: string) {
    return this.prisma.$transaction((tx) =>
      this.markPaidInTransaction(tx, orderId, updatedById),
    );
  }

  async markPaidInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    updatedById?: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === OrderStatus.PAID)
      return this.findOrderDetailsById(tx, orderId);
    this.assertTransition(order.status, OrderStatus.PAID);
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        paymentStatus: { not: PaymentStatus.PAID },
      },
      data: {
        status: OrderStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        reservationExpiresAt: null,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    if (updated.count !== 1)
      throw new ConflictException("Order reservation has expired");
    await this.emitStatusChanged(
      tx,
      orderId,
      order.status,
      updatedById ? "admin" : "system",
    );
    return this.findOrderDetailsById(tx, orderId);
  }

  async markCodCollected(orderId: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.paymentMethod !== PaymentMethod.COD) {
        throw new BadRequestException("Order is not a COD order");
      }

      if (
        order.status !== OrderStatus.SHIPPED &&
        order.status !== OrderStatus.DELIVERED
      ) {
        throw new BadRequestException(
          `COD collection can only be performed for orders in SHIPPED or DELIVERED status (current: ${order.status})`,
        );
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        return this.findOrderDetailsById(tx, orderId);
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          ...(actorUserId ? { updatedById: actorUserId } : {}),
        },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "order.cod_collected",
        entityType: "Order",
        entityId: orderId,
        changes: { paymentStatus: { from: order.paymentStatus, to: PaymentStatus.PAID } },
      });

      const details = await this.findOrderDetailsById(tx, orderId);
      await this.agentEvents?.enqueueInTx(tx, "payment.succeeded", {
        order: toOrderRef(details),
        payment_id: `cod_${details.id}`,
        provider: "cod",
        provider_txn_id: null,
        amount_piasters: toPiasters(details.totalAmount),
        paid_at: new Date().toISOString(),
        collected_by: actorUserId ?? null,
      });
      return details;
    });
  }

  async transitionStatus(
    orderId: string,
    nextStatus: OrderStatus,
    actorUserId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({ where: { id: orderId } });
      if (!before) {
        throw new NotFoundException("Order not found");
      }

      if (before.status === nextStatus) {
        return { before, after: await this.findOrderDetailsById(tx, orderId) };
      }

      this.assertTransition(before.status, nextStatus);

      let after;
      if (
        nextStatus === OrderStatus.CANCELLED ||
        nextStatus === OrderStatus.EXPIRED
      ) {
        if (before.paymentMethod === PaymentMethod.COD) {
          const cancelled = await this.cancelCodOrderInTransaction(
            tx,
            orderId,
            nextStatus,
            actorUserId,
            actorUserId ? "admin" : "system",
          );
          if (!cancelled) {
            throw new ConflictException("Order cannot be cancelled");
          }
        } else {
          // Cancelling and expiring a PENDING order follow the same reservation-release logic.
          const released = await this.cancelPendingOrderInTransaction(
            tx,
            orderId,
            nextStatus,
            undefined,
            actorUserId,
            actorUserId ? "admin" : "system",
          );
          if (!released) {
            throw new ConflictException("Order is no longer pending");
          }
        }
        after = await this.findOrderDetailsById(tx, orderId);
      } else if (nextStatus === OrderStatus.PAID) {
        after = await this.markPaidInTransaction(tx, orderId, actorUserId);
      } else {
        after = await tx.order.update({
          where: { id: orderId },
          data: {
            status: nextStatus,
            ...(actorUserId ? { updatedById: actorUserId } : {}),
          },
          include: orderInclude,
        });
        await this.emitStatusChanged(
          tx,
          orderId,
          before.status,
          actorUserId ? "admin" : "system",
        );
      }

      return { before, after };
    });

    await this.kickAgent();

    if (actorUserId && result.before.status !== result.after.status) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "order.status-transition",
        entityType: "Order",
        entityId: result.after.id,
        changes: { from: result.before.status, to: result.after.status },
      });
    }

    return result.after;
  }

  async cancelPendingOrder(
    orderId: string,
    status: "CANCELLED" | "EXPIRED",
    updatedById?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.cancelPendingOrderInTransaction(
        tx,
        orderId,
        status,
        undefined,
        updatedById,
      ),
    );
  }

  async cancelByOrderNumber(orderNumber: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber } });
      if (!order) {
        throw new NotFoundException(`Order ${orderNumber} was not found`);
      }
      let cancelled = false;
      if (order.paymentMethod === PaymentMethod.COD) {
        const cancellableStatuses: OrderStatus[] = [
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
        ];
        if (!cancellableStatuses.includes(order.status)) {
          throw new ConflictException("Order cannot be cancelled in current status");
        }
        cancelled = await this.cancelCodOrderInTransaction(
          tx,
          order.id,
          OrderStatus.CANCELLED,
          undefined,
          "customer",
        );
      } else {
        if (order.status !== OrderStatus.PENDING) {
          throw new ConflictException("Only pending orders can be cancelled");
        }
        cancelled = await this.cancelPendingOrderInTransaction(
          tx,
          order.id,
          OrderStatus.CANCELLED,
          undefined,
          undefined,
          "customer",
        );
      }
      if (!cancelled) {
        throw new ConflictException("Order cannot be cancelled");
      }
      return this.findOrderDetailsById(tx, order.id);
    });
    await this.kickAgent();
    return result;
  }

  async expireOrder(orderId: string, now = new Date()) {
    return this.prisma.$transaction((tx) =>
      this.cancelPendingOrderInTransaction(
        tx,
        orderId,
        OrderStatus.EXPIRED,
        now,
      ),
    );
  }

  async expirePendingReservations(now = new Date()) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        reservationExpiresAt: { lte: now },
      },
      select: { id: true },
    });
    let expiredCount = 0;
    for (const order of orders)
      if (await this.expireOrder(order.id, now)) expiredCount += 1;
    if (expiredCount > 0) await this.kickAgent();
    return expiredCount;
  }

  async findAll(
    filters: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
    pagination: PaginationInput,
  ) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: Prisma.OrderWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.search) {
      const searchTrimmed = filters.search.trim();
      if (searchTrimmed) {
        where.OR = [
          { orderNumber: { contains: searchTrimmed, mode: "insensitive" } },
          { customerName: { contains: searchTrimmed, mode: "insensitive" } },
          { customerEmail: { contains: searchTrimmed, mode: "insensitive" } },
        ];
      }
    }

    if (filters.startDate || filters.endDate) {
      const createdAtWhere: Prisma.DateTimeFilter = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        if (isNaN(start.getTime())) {
          throw new BadRequestException("Invalid startDate parameter");
        }
        createdAtWhere.gte = start;
      }

      if (filters.endDate) {
        const end = new Date(filters.endDate);
        if (isNaN(end.getTime())) {
          throw new BadRequestException("Invalid endDate parameter");
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate.trim())) {
          end.setUTCHours(23, 59, 59, 999);
        }
        createdAtWhere.lte = end;
      }

      if (
        createdAtWhere.gte &&
        createdAtWhere.lte &&
        createdAtWhere.gte > createdAtWhere.lte
      ) {
        throw new BadRequestException("startDate must not be later than endDate");
      }

      where.createdAt = createdAtWhere;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findByIdForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found`);
    }

    return order;
  }

  async updateShipping(
    id: string,
    dto: UpdateOrderShippingDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Order ${id} was not found`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
        ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber } : {}),
        ...(dto.trackingUrl !== undefined ? { trackingUrl: dto.trackingUrl } : {}),
        ...(dto.shippingAddress !== undefined ? { shippingAddress: dto.shippingAddress } : {}),
        ...(actorUserId ? { updatedBy: { connect: { id: actorUserId } } } : {}),
      },
      include: orderInclude,
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "order.shipping.update",
      entityType: "Order",
      entityId: id,
      changes: dto,
    });

    return updatedOrder;
  }

  /**
   * Permanently deletes an order (e.g. a test order). Stock the order still
   * holds (not cancelled/expired and not yet shipped) is returned first, and a
   * coupon use is released. Items and status history are removed by cascade.
   * Raw SQL is used because the soft-delete middleware would otherwise turn
   * the delete into an update and keep the rows.
   */
  async deleteOrderPermanently(id: string, actorUserId?: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          couponId: true,
          totalAmount: true,
        },
      });
      if (!existing) {
        throw new NotFoundException(`Order ${id} was not found`);
      }

      if (ORDER_STATUSES_HOLDING_STOCK.includes(existing.status)) {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });
        for (const item of items) {
          await tx.productVariant.updateMany({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        if (existing.couponId) {
          await tx.coupon.updateMany({
            where: { id: existing.couponId, usageCount: { gt: 0 } },
            data: { usageCount: { decrement: 1 } },
          });
        }
      }

      await tx.$executeRaw`DELETE FROM "Order" WHERE "id" = ${id}`;
      return existing;
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "order.delete",
      entityType: "Order",
      entityId: order.id,
      changes: {
        deleted: true,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount?.toString(),
        stockReturned: ORDER_STATUSES_HOLDING_STOCK.includes(order.status),
      },
    });

    return { id: order.id, deleted: true };
  }

  /**
   * Releases an unfulfilled PENDING order reservation, transitioning status to CANCELLED or EXPIRED
   * and returning reserved item quantities back to available inventory.
   *
   * WHY: Using updateMany with status: PENDING ensures idempotent release — if concurrent requests
   * attempt cancellation, only the first call matches updated.count === 1 and restores inventory.
   */
  async cancelCodOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: OrderStatus,
    updatedById?: string,
    actor: "customer" | "admin" | "system" = updatedById ? "admin" : "system",
  ) {
    const previous = this.agentEvents
      ? await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        })
      : null;
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        paymentMethod: PaymentMethod.COD,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
      },
      data: {
        status,
        reservationExpiresAt: null,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    if (updated.count === 0) return false;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { couponId: true },
    });

    if (order?.couponId) {
      await tx.coupon.updateMany({
        where: {
          id: order.couponId,
          usageCount: { gt: 0 },
        },
        data: {
          usageCount: { decrement: 1 },
        },
      });
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });
    await Promise.all(
      items.map((item) =>
        tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stock: { increment: item.quantity } },
        }),
      ),
    );
    if (previous) {
      await this.emitStatusChanged(tx, orderId, previous.status, actor);
    }
    return true;
  }

  async cancelPendingOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: "CANCELLED" | "EXPIRED",
    now?: Date,
    updatedById?: string,
    actor: "customer" | "admin" | "system" = updatedById ? "admin" : "system",
  ) {
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING,
        ...(now ? { reservationExpiresAt: { lte: now } } : {}),
      },
      data: {
        status,
        reservationExpiresAt: null,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    if (updated.count === 0) return false;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { couponId: true },
    });

    if (order?.couponId) {
      await tx.coupon.updateMany({
        where: {
          id: order.couponId,
          usageCount: { gt: 0 },
        },
        data: {
          usageCount: { decrement: 1 },
        },
      });
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });
    // Restore variant stock concurrently within the transaction.
    await Promise.all(
      items.map((item) =>
        tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stock: { increment: item.quantity } },
        }),
      ),
    );
    await this.emitStatusChanged(tx, orderId, OrderStatus.PENDING, actor);
    return true;
  }

  /**
   * Retrieves an order by its order number, enforcing ownership via the shared
   * `isOrderOwnedByActor` check (same helper used by OrdersController and
   * PaymentService). ADMIN callers bypass the ownership check.
   *
   * Any access-denial path (order genuinely missing, guest access token
   * mismatch, or an authenticated user requesting someone else's order)
   * throws the same `NotFoundException` with the same message, so a caller
   * cannot distinguish "order does not exist" from "order exists but you
   * don't own it" — preventing order-existence enumeration.
   */
  async trackOrder(dto: TrackOrderDto) {
    this.checkOrderTrackRateLimit(dto.orderNumber);

    const normalizedInputPhone = normalizeEgyptianPhone(dto.phone);

    const order = await this.prisma.order.findUnique({
      where: { orderNumber: dto.orderNumber },
      include: orderInclude,
    });

    const normalizedOrderPhone = order?.shippingPhone
      ? normalizeEgyptianPhone(order.shippingPhone)
      : null;

    // Dummy compare target ensures timingSafeStringEqual is executed unconditionally
    // even if order is missing or has no shippingPhone, preventing timing side-channel leakage.
    const compareTargetPhone = normalizedOrderPhone ?? "+201000000000";
    const phoneMatches =
      normalizedInputPhone !== null &&
      timingSafeStringEqual(
        normalizedInputPhone,
        compareTargetPhone,
      );

    const isMatch = Boolean(order && normalizedOrderPhone && phoneMatches);

    if (!order || !isMatch) {
      await this.auditLogService
        .record({
          action: "order.track_failed",
          entityType: "Order",
          entityId: dto.orderNumber,
          changes: { phoneLast3: maskPhoneLast3(dto.phone) },
        })
        .catch((err) => {
          this.logger.error("Failed to log order track audit", err);
        });

      this.logger.warn(
        `Failed order tracking attempt for orderNumber: ${dto.orderNumber}, phone ending with: ${maskPhoneLast3(dto.phone)}`,
      );

      throw new NotFoundException("Order not found");
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      codFee: order.codFee,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippingCity: order.shippingCity,
      items: order.items.map((item) => ({
        productName: item.productVariant?.product?.name ?? "",
        size: item.productVariant?.size ?? null,
        quantity: item.quantity,
        price: item.unitPrice,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };
  }

  async findOne(
    orderNumber: string,
    actor?: { userId?: string; role?: string; guestAccessToken?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} was not found`);
    }

    if (actor?.role !== "ADMIN" && !isOrderOwnedByActor(order, actor)) {
      throw new NotFoundException(`Order ${orderNumber} was not found`);
    }

    return order;
  }
}
