import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { CouponType, OrderStatus, PaymentStatus, ProductStatus } from "@prisma/client";
import { OrdersService } from "./orders.service";

const dto = {
  customerName: "Aisha Rahman",
  customerEmail: "aisha@example.com",
  shippingCity: "Cairo",
  shippingPhone: "01000000000",
  items: [{ productVariantId: "variant-1", quantity: 1 }],
};

const defaultShippingZones = [
  {
    id: "sz-1",
    cityLabel: "Cairo",
    price: "50.00",
    isActive: true,
  },
  {
    id: "sz-2",
    cityLabel: "Alexandria",
    price: "70.00",
    isActive: true,
  },
  {
    id: "sz-3",
    cityLabel: "Giza",
    price: "45.00",
    isActive: false,
  },
];

function transactionPrisma(stock = 1, couponInitial?: any, siteSettingsOverride?: any, shippingZonesOverride?: any) {
  const variant = {
    id: "variant-1",
    stock,
    isAvailable: true,
    price: "25.00",
    product: { status: ProductStatus.ACTIVE },
  };
  const coupon = couponInitial ?? {
    id: "coupon-1",
    code: "SUMMER20",
    type: CouponType.PERCENTAGE,
    value: "20.00",
    isActive: true,
    expiresAt: null,
    usageLimit: 5,
    usageCount: 0,
    usagePerCustomer: null,
    minOrderAmount: null,
  };
  const order: any = {
    id: "order-1",
    orderNumber: "RIV-1000-ABC",
    userId: null,
    guestAccessToken: "guest-token",
    status: OrderStatus.PENDING,
    reservationExpiresAt: new Date(Date.now() + 60_000),
    couponId: null,
    couponCode: null,
    items: [
      { productVariantId: "variant-1", quantity: 1, productVariant: variant },
    ],
  };
  const tx: any = {
    productVariant: {
      findMany: jest.fn().mockResolvedValue([variant]),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!variant.isAvailable || variant.stock < where.stock.gte)
          return { count: 0 };
        variant.stock -= data.stock.decrement;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => ({
        ...variant,
        stock: (variant.stock += data.stock.increment),
      })),
    },
    coupon: {
      findUnique: jest.fn(async ({ where }) => {
        if (!coupon || (where.code && where.code !== coupon.code) || (where.id && where.id !== coupon.id)) {
          return null;
        }
        return coupon;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!coupon || coupon.id !== where.id) {
          return { count: 0 };
        }
        if (where.isActive !== undefined && coupon.isActive !== where.isActive) {
          return { count: 0 };
        }
        if (where.usageCount?.lt !== undefined && coupon.usageCount >= where.usageCount.lt) {
          return { count: 0 };
        }
        if (where.usageCount?.gt !== undefined && coupon.usageCount <= where.usageCount.gt) {
          return { count: 0 };
        }
        if (data.usageCount?.increment) {
          coupon.usageCount += data.usageCount.increment;
        }
        if (data.usageCount?.decrement) {
          coupon.usageCount = Math.max(0, coupon.usageCount - data.usageCount.decrement);
        }
        return { count: 1 };
      }),
    },
    order: {
      create: jest.fn(async ({ data }) => {
        if (data.couponId) {
          order.couponId = data.couponId;
          order.couponCode = data.couponCode;
        }
        return {
          ...order,
          ...data,
          items: order.items,
        };
      }),
      findUnique: jest.fn(async ({ where }) => {
        if (where.id && where.id !== order.id) return null;
        if (where.orderNumber && where.orderNumber !== order.orderNumber)
          return null;
        return order;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        if (where.id !== order.id)
          throw new NotFoundException("Order not found");
        return order;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (order.id !== where.id || order.status !== where.status)
          return { count: 0 };
        if (
          where.reservationExpiresAt?.lte &&
          order.reservationExpiresAt > where.reservationExpiresAt.lte
        )
          return { count: 0 };
        if (
          where.reservationExpiresAt?.gt &&
          (!order.reservationExpiresAt ||
            order.reservationExpiresAt <= new Date())
        )
          return { count: 0 };
        order.status = data.status;
        order.reservationExpiresAt = data.reservationExpiresAt ?? null;
        if (data.updatedById) order.updatedById = data.updatedById;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => {
        order.status = data.status;
        if (data.updatedById) order.updatedById = data.updatedById;
        return order;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    orderItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ productVariantId: "variant-1", quantity: 1 }]),
    },
    shippingZone: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const zones = shippingZonesOverride ?? defaultShippingZones;
        if (where?.isActive) {
          return zones.filter((z: any) => z.isActive);
        }
        return zones;
      }),
    },
    siteSettings: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.id === "default") {
          return (
            siteSettingsOverride ?? {
              id: "default",
              minimumOrderAmount: "0.00",
              freeShippingThreshold: null,
            }
          );
        }
        return null;
      }),
    },
  };
  const prisma = {
    $transaction: (callback: any) => callback(tx),
    order: tx.order,
  };
  const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, tx, variant, coupon, order, auditLogService };
}

describe("OrdersService inventory reservations", () => {
  it("allows exactly one of two simultaneous reservations when stock is one", async () => {
    const context = transactionPrisma(1);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const results = await Promise.allSettled([
      service.create(dto),
      service.create(dto),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(context.variant.stock).toBe(0);
  });

  it("returns existing order when called with duplicate idempotencyKey", async () => {
    const context = transactionPrisma(5);
    context.order.idempotencyKey = "idemp-key-123";
    context.prisma.order.findUnique = jest.fn().mockImplementation(async ({ where }: any) => {
      if (where.idempotencyKey === "idemp-key-123") {
        return context.order;
      }
      return null;
    });

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.create({
      ...dto,
      idempotencyKey: "idemp-key-123",
    });

    expect(result).toMatchObject({ id: "order-1", idempotencyKey: "idemp-key-123" });
    expect(context.tx.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("rolls back a reservation when stock is insufficient", async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(context.tx.order.create).not.toHaveBeenCalled();
    expect(context.variant.stock).toBe(0);
  });

  it("rejects duplicate variants before reserving stock", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, items: [dto.items[0], dto.items[0]] }),
    ).rejects.toThrow("Duplicate");
    expect(context.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("restores an expired reservation exactly once", async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );
    const expirationMoment = new Date(Date.now() + 120_000);

    await expect(
      service.expireOrder("order-1", expirationMoment),
    ).resolves.toBe(true);
    await expect(
      service.expireOrder("order-1", expirationMoment),
    ).resolves.toBe(false);
    expect(context.variant.stock).toBe(1);
    expect(context.order.status).toBe(OrderStatus.EXPIRED);
  });

  it("does not expire or restore stock for paid orders", async () => {
    const context = transactionPrisma(0);
    context.order.status = OrderStatus.PAID;
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(service.expireOrder("order-1", new Date())).resolves.toBe(
      false,
    );
    expect(context.variant.stock).toBe(0);
    expect(context.order.status).toBe(OrderStatus.PAID);
  });

  it("rejects invalid order state transitions", async () => {
    const context = transactionPrisma();
    context.order.status = OrderStatus.DELIVERED;
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.transitionStatus("order-1", OrderStatus.PAID, "admin-1"),
    ).rejects.toThrow("Cannot transition");
  });

  it("cancels a pending order by order number using shared stock restoration logic", async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.cancelByOrderNumber("RIV-1000-ABC"),
    ).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    expect(context.variant.stock).toBe(1);
  });

  it("rejects cancellation when the order is no longer pending", async () => {
    const context = transactionPrisma(0);
    context.order.status = OrderStatus.PAID;
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.cancelByOrderNumber("RIV-1000-ABC"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("OrdersService.findAll filtering", () => {
  it("returns orders without filters preserving default behavior", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.findAll({}, { page: 1, limit: 10 });

    expect(context.prisma.order.findMany).toHaveBeenCalledWith({
      where: {},
      include: expect.any(Object),
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
    });
  });

  it("filters orders by status alone", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.findAll({ status: OrderStatus.CONFIRMED }, { page: 1, limit: 10 });

    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OrderStatus.CONFIRMED },
      }),
    );
  });

  it("filters orders by paymentStatus alone", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.findAll({ paymentStatus: PaymentStatus.PAID }, { page: 1, limit: 10 });

    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentStatus: PaymentStatus.PAID },
      }),
    );
  });

  it("filters orders by search matching orderNumber, customerName, or customerEmail (case-insensitive)", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    // Test lowercase query
    await service.findAll({ search: "aisha" }, { page: 1, limit: 10 });
    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { orderNumber: { contains: "aisha", mode: "insensitive" } },
            { customerName: { contains: "aisha", mode: "insensitive" } },
            { customerEmail: { contains: "aisha", mode: "insensitive" } },
          ],
        },
      }),
    );

    // Test uppercase query
    await service.findAll({ search: "RIV-1000" }, { page: 1, limit: 10 });
    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { orderNumber: { contains: "RIV-1000", mode: "insensitive" } },
            { customerName: { contains: "RIV-1000", mode: "insensitive" } },
            { customerEmail: { contains: "RIV-1000", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("filters orders by startDate and endDate range", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.findAll(
      { startDate: "2026-01-01", endDate: "2026-01-31" },
      { page: 1, limit: 10 },
    );

    const expectedStart = new Date("2026-01-01");
    const expectedEnd = new Date("2026-01-31");
    expectedEnd.setUTCHours(23, 59, 59, 999);

    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: expectedStart,
            lte: expectedEnd,
          },
        },
      }),
    );
  });

  it("throws BadRequestException if startDate is later than endDate", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findAll(
        { startDate: "2026-05-10", endDate: "2026-05-01" },
        { page: 1, limit: 10 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("combines status, paymentStatus, search, and date filters", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.findAll(
      {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        search: "Aisha",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      },
      { page: 1, limit: 10 },
    );

    const expectedStart = new Date("2026-01-01");
    const expectedEnd = new Date("2026-01-31");
    expectedEnd.setUTCHours(23, 59, 59, 999);

    expect(context.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          OR: [
            { orderNumber: { contains: "Aisha", mode: "insensitive" } },
            { customerName: { contains: "Aisha", mode: "insensitive" } },
            { customerEmail: { contains: "Aisha", mode: "insensitive" } },
          ],
          createdAt: {
            gte: expectedStart,
            lte: expectedEnd,
          },
        },
      }),
    );
  });
});

describe("OrdersService discount and pricing security", () => {
  it("ignores any client-provided discount and sets discount to 0 when no coupon is provided", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    // Cast as any in case client attempts to pass discount property
    const result = await service.create({
      ...dto,
      discount: 10,
    } as any);

    expect(result.discount).toBe("0");
    expect(result.shippingFee).toBe("50");
    expect(result.totalAmount).toBe("75"); // 25 subtotal - 0 discount + 50 shipping
  });

  it("calculates server-computed discount when a valid couponCode is provided", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.create({
      ...dto,
      couponCode: "SUMMER20",
    });

    expect(result.couponId).toBe("coupon-1");
    expect(result.couponCode).toBe("SUMMER20");
    expect(result.discount).toBe("5"); // 20% of 25.00 = 5.00
    expect(result.shippingFee).toBe("50");
    expect(result.totalAmount).toBe("70"); // 25 - 5 + 50
    expect(context.coupon.usageCount).toBe(1);
  });

  it("rejects order creation when couponCode is invalid or inactive", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, couponCode: "INVALID_CODE" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects order creation when couponCode is expired", async () => {
    const expiredCoupon = {
      id: "coupon-expired",
      code: "EXPIRED10",
      type: CouponType.FIXED,
      value: "10.00",
      isActive: true,
      expiresAt: new Date(Date.now() - 10_000), // in the past
      usageLimit: null,
      usageCount: 0,
      usagePerCustomer: null,
      minOrderAmount: null,
    };
    const context = transactionPrisma(5, expiredCoupon);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, couponCode: "EXPIRED10" }),
    ).rejects.toThrow("Coupon has expired");
  });
});

describe("OrdersService coupon usage tracking", () => {
  it("increments coupon usageCount and calculates discount when valid coupon is provided", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.create({
      ...dto,
      couponCode: "SUMMER20",
    });

    expect(result.couponId).toBe("coupon-1");
    expect(result.couponCode).toBe("SUMMER20");
    expect(result.discount).toBe("5"); // 20% of 25.00 = 5.00
    expect(context.coupon.usageCount).toBe(1);
  });

  it("rejects order creation when coupon usageLimit is reached", async () => {
    const context = transactionPrisma(5);
    context.coupon.usageLimit = 5;
    context.coupon.usageCount = 5;

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, couponCode: "SUMMER20" }),
    ).rejects.toThrow("Coupon usage limit reached");
    expect(context.coupon.usageCount).toBe(5);
  });

  it("prevents concurrent order creation from exceeding usageLimit when limit is 1", async () => {
    const context = transactionPrisma(5);
    context.coupon.usageLimit = 1;
    context.coupon.usageCount = 0;

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const results = await Promise.allSettled([
      service.create({ ...dto, couponCode: "SUMMER20" }),
      service.create({ ...dto, couponCode: "SUMMER20" }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(context.coupon.usageCount).toBe(1);
  });

  it("rejects order creation when user exceeds usagePerCustomer limit", async () => {
    const context = transactionPrisma(5);
    context.coupon.usagePerCustomer = 1;
    context.tx.order.count.mockResolvedValue(1);

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, couponCode: "SUMMER20" }, "user-1"),
    ).rejects.toThrow("Coupon customer usage limit reached");
    expect(context.coupon.usageCount).toBe(0);
  });

  it("decrements coupon usageCount when pending order is cancelled or expires", async () => {
    const context = transactionPrisma(0);
    context.order.couponId = "coupon-1";
    context.coupon.usageCount = 1;

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await service.cancelByOrderNumber("RIV-1000-ABC");

    expect(context.order.status).toBe(OrderStatus.CANCELLED);
    expect(context.coupon.usageCount).toBe(0);
  });

  it("does not double decrement coupon usageCount on repeated cancellation or expiry", async () => {
    const context = transactionPrisma(0);
    context.order.couponId = "coupon-1";
    context.coupon.usageCount = 1;

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const expirationMoment = new Date(Date.now() + 120_000);

    const firstResult = await service.expireOrder("order-1", expirationMoment);
    expect(firstResult).toBe(true);
    expect(context.coupon.usageCount).toBe(0);

    const secondResult = await service.expireOrder("order-1", expirationMoment);
    expect(secondResult).toBe(false);
    expect(context.coupon.usageCount).toBe(0);
  });
});

describe("OrdersService.findOne ownership enforcement and missing order handling", () => {
  it("throws NotFoundException when order is not found in database (!order branch)", async () => {
    const context = transactionPrisma();
    context.prisma.order.findUnique.mockResolvedValue(null);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-NONEXISTENT", { role: "ADMIN" }),
    ).rejects.toThrow(
      new NotFoundException("Order RIV-NONEXISTENT was not found"),
    );
  });

  it("returns the order for the matching guest access token holder", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-1000-ABC", { guestAccessToken: "guest-token" }),
    ).resolves.toMatchObject({ orderNumber: "RIV-1000-ABC" });
  });

  it("rejects a mismatched guest access token with the same NotFoundException used for a missing order", async () => {
    const context = transactionPrisma();
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-1000-ABC", { guestAccessToken: "wrong-token" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an authenticated user requesting another user's order with a NotFoundException (not Forbidden)", async () => {
    const context = transactionPrisma();
    context.order.userId = "owner-1";
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-1000-ABC", {
        userId: "other-user",
        role: "CUSTOMER",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows the owning authenticated user to fetch their order", async () => {
    const context = transactionPrisma();
    context.order.userId = "owner-1";
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-1000-ABC", { userId: "owner-1", role: "CUSTOMER" }),
    ).resolves.toMatchObject({ orderNumber: "RIV-1000-ABC" });
  });

  it("allows an admin to bypass ownership checks entirely", async () => {
    const context = transactionPrisma();
    context.order.userId = "owner-1";
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.findOne("RIV-1000-ABC", { userId: "admin-1", role: "ADMIN" }),
    ).resolves.toMatchObject({ orderNumber: "RIV-1000-ABC" });
  });

  it("updates order shipping details and records audit log", async () => {
    const context = transactionPrisma();
    context.prisma.order.findUnique = jest.fn().mockResolvedValue({ id: "order-1", status: "PROCESSING" });
    context.prisma.order.update = jest.fn().mockResolvedValue({
      id: "order-1",
      carrier: "DHL",
      trackingNumber: "TRACK123",
      trackingUrl: "https://dhl.com/TRACK123",
      shippingAddress: "123 Cairo St",
    });

    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.updateShipping("order-1", {
      carrier: "DHL",
      trackingNumber: "TRACK123",
      trackingUrl: "https://dhl.com/TRACK123",
      shippingAddress: "123 Cairo St",
    }, "admin-1");

    expect(result.carrier).toBe("DHL");
    expect(context.auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "order.shipping.update",
        entityType: "Order",
        entityId: "order-1",
      }),
    );
  });
});

describe("OrdersService server-controlled shipping fee calculation", () => {
  it("computes shipping fee from matching active zone and ignores client-supplied shippingFee", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.create({
      ...dto,
      shippingCity: "Alexandria",
      shippingFee: 0, // Client tries to override fee to 0
    } as any);

    expect(result.shippingFee).toBe("70"); // Fee from Alexandria zone is 70.00
    expect(result.totalAmount).toBe("95"); // 25 + 70
  });

  it("rejects order creation when shippingCity is missing or empty", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, shippingCity: "  " }),
    ).rejects.toThrow("Shipping city is required");
  });

  it("rejects order creation when no active shipping zone matches shippingCity", async () => {
    const context = transactionPrisma(5);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, shippingCity: "Giza" }), // Giza is inactive in default mock
    ).rejects.toThrow('No active shipping zone found for city "Giza"');
  });

  it("applies free shipping when discounted subtotal reaches or exceeds freeShippingThreshold", async () => {
    const siteSettings = {
      id: "default",
      minimumOrderAmount: "0.00",
      freeShippingThreshold: "20.00",
    };
    const context = transactionPrisma(5, undefined, siteSettings);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    const result = await service.create({
      ...dto,
      shippingCity: "Cairo",
    });

    // Subtotal = 25.00 >= freeShippingThreshold (20.00)
    expect(result.shippingFee).toBe("0");
    expect(result.totalAmount).toBe("25");
  });

  it("does not apply free shipping when discounted subtotal falls below freeShippingThreshold after discount", async () => {
    const siteSettings = {
      id: "default",
      minimumOrderAmount: "0.00",
      freeShippingThreshold: "22.00",
    };
    const context = transactionPrisma(5, undefined, siteSettings);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    // Subtotal = 25.00, discount = 5.00 => discounted subtotal = 20.00 < threshold 22.00
    const result = await service.create({
      ...dto,
      shippingCity: "Cairo",
      couponCode: "SUMMER20",
    });

    expect(result.shippingFee).toBe("50");
    expect(result.totalAmount).toBe("70"); // 25 - 5 + 50
  });

  it("rejects order creation when subtotal is below minimumOrderAmount", async () => {
    const siteSettings = {
      id: "default",
      minimumOrderAmount: "100.00",
      freeShippingThreshold: null,
    };
    const context = transactionPrisma(5, undefined, siteSettings);
    const service = new OrdersService(
      context.prisma as any,
      context.auditLogService as any,
    );

    await expect(
      service.create({ ...dto, shippingCity: "Cairo" }),
    ).rejects.toThrow("Minimum order amount is 100");
  });
});
