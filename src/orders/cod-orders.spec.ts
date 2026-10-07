import { BadRequestException } from "@nestjs/common";
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus } from "@prisma/client";
import { OrdersService } from "./orders.service";

describe("OrdersService COD Support", () => {
  let service: OrdersService;
  let mockPrisma: any;
  let mockAuditLogService: any;
  let mockNotificationsService: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      siteSettings: {
        findUnique: jest.fn(),
      },
      shippingZone: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockAuditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockNotificationsService = {
      notifyOrderCreated: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      mockPrisma,
      mockAuditLogService,
      mockNotificationsService,
    );
  });

  describe("create COD order", () => {
    const validVariant = {
      id: "var_1",
      price: "100",
      stock: 10,
      isAvailable: true,
      product: { status: ProductStatus.ACTIVE, name: "Luxury Jacket" },
    };

    const validZone = {
      id: "zone_1",
      cityLabel: "Cairo",
      price: "20",
      isActive: true,
    };

    const baseDto: any = {
      customerName: "Mohamed Ahmed",
      customerEmail: "mohamed@example.com",
      shippingAddress: "123 Nile St",
      shippingCity: "Cairo",
      shippingPhone: "01012345678",
      paymentMethod: PaymentMethod.COD,
      items: [{ productVariantId: "var_1", quantity: 1 }],
    };

    it("should successfully create a COD order with codFee and totalAmount calculated", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        codEnabled: true,
        codFee: "15.00",
        codMaxAmount: "2000.00",
        minimumOrderAmount: "0",
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);

      const expectedOrder = {
        id: "ord_1",
        orderNumber: "RIV-123",
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        codFee: "15",
        subtotal: "100",
        discount: "0",
        shippingFee: "20",
        totalAmount: "135", // 100 + 20 + 15
        shippingPhone: "+201012345678",
        reservationExpiresAt: null,
      };

      mockPrisma.order.create.mockResolvedValue(expectedOrder);

      const result = await service.create(baseDto);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: PaymentMethod.COD,
            codFee: "15",
            totalAmount: "135",
            reservationExpiresAt: null,
            shippingPhone: "+201012345678",
          }),
        }),
      );
      expect(mockNotificationsService.notifyOrderCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: "RIV-123",
        }),
      );
      expect(result.paymentMethod).toBe(PaymentMethod.COD);
    });

    it("should reject COD order if codEnabled=false", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        codEnabled: false,
      });

      await expect(service.create(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject COD order if order total before COD fee exceeds codMaxAmount", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        codEnabled: true,
        codFee: "15.00",
        codMaxAmount: "100.00", // Total before COD fee = 100 (subtotal) + 20 (shipping) = 120 > 100
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);

      await expect(service.create(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject COD order if shippingAddress is missing or empty", async () => {
      const invalidDto = { ...baseDto, shippingAddress: "   " };
      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject COD order if shippingPhone is invalid Egyptian number", async () => {
      const invalidDto = { ...baseDto, shippingPhone: "01912345678" }; // 019 is invalid
      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should sanitize shippingPhone (strip spaces and dashes) and accept valid +2010 format", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        codEnabled: true,
        codFee: "0",
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);
      mockPrisma.order.create.mockResolvedValue({
        id: "ord_1",
        orderNumber: "RIV-123",
        paymentMethod: PaymentMethod.COD,
        totalAmount: "120",
      });

      const dtoWithFormattedPhone = {
        ...baseDto,
        shippingPhone: "+20 100-123-4567",
      };

      await service.create(dtoWithFormattedPhone);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingPhone: "+201001234567",
          }),
        }),
      );
    });

    it("should not break order creation if notifyOrderCreated throws an error", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        codEnabled: true,
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);
      mockPrisma.order.create.mockResolvedValue({
        id: "ord_1",
        orderNumber: "RIV-123",
        paymentMethod: PaymentMethod.COD,
        totalAmount: "120",
      });

      mockNotificationsService.notifyOrderCreated.mockRejectedValue(
        new Error("WhatsApp API error"),
      );

      const result = await service.create(baseDto);
      expect(result.id).toBe("ord_1");
    });

    it("should NOT trigger creation notification for ONLINE orders", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);
      mockPrisma.order.create.mockResolvedValue({
        id: "ord_online",
        orderNumber: "RIV-ONLINE",
        paymentMethod: PaymentMethod.ONLINE,
        totalAmount: "120",
      });

      const onlineDto = { ...baseDto, paymentMethod: PaymentMethod.ONLINE };
      await service.create(onlineDto);

      expect(mockNotificationsService.notifyOrderCreated).not.toHaveBeenCalled();
    });

    it("should calculate free shipping based on subtotal-discount without including codFee", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([
        { ...validVariant, price: "500" },
      ]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.siteSettings.findUnique.mockResolvedValue({
        id: "default",
        freeShippingThreshold: "500.00", // Free shipping applies
        codEnabled: true,
        codFee: "25.00",
      });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);
      mockPrisma.order.create.mockResolvedValue({
        id: "ord_free_ship",
        orderNumber: "RIV-FREE",
        paymentMethod: PaymentMethod.COD,
        shippingFee: "0",
        codFee: "25",
        totalAmount: "525", // 500 + 0 + 25
      });

      const dto = { ...baseDto, items: [{ productVariantId: "var_1", quantity: 1 }] };
      await service.create(dto);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingFee: "0",
            codFee: "25",
            totalAmount: "525",
          }),
        }),
      );
    });
  });

  describe("markCodCollected", () => {
    it("should mark paymentStatus as PAID for a COD order in SHIPPED status", async () => {
      const codOrder = {
        id: "ord_cod_1",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(codOrder);
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
        ...codOrder,
        paymentStatus: PaymentStatus.PAID,
      });
      mockPrisma.order.update.mockResolvedValue({
        ...codOrder,
        paymentStatus: PaymentStatus.PAID,
      });

      await service.markCodCollected("ord_cod_1", "admin_1");

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "ord_cod_1" },
        data: { paymentStatus: PaymentStatus.PAID, updatedById: "admin_1" },
      });
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "order.cod_collected",
          entityId: "ord_cod_1",
        }),
      );
    });

    it("should be idempotent if order paymentStatus is already PAID", async () => {
      const paidCodOrder = {
        id: "ord_cod_1",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      };

      mockPrisma.order.findUnique.mockResolvedValue(paidCodOrder);
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue(paidCodOrder);

      await service.markCodCollected("ord_cod_1", "admin_1");

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if order is ONLINE paymentMethod", async () => {
      const onlineOrder = {
        id: "ord_online_1",
        paymentMethod: PaymentMethod.ONLINE,
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(onlineOrder);

      await expect(
        service.markCodCollected("ord_online_1", "admin_1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if order status is not SHIPPED or DELIVERED", async () => {
      const pendingCodOrder = {
        id: "ord_cod_pending",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
      };

      mockPrisma.order.findUnique.mockResolvedValue(pendingCodOrder);

      await expect(
        service.markCodCollected("ord_cod_pending", "admin_1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("COD order cancellation", () => {
    it("should restore stock and coupon usage count when cancelling a COD order from CONFIRMED status", async () => {
      const confirmedCodOrder = {
        id: "ord_cod_conf",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.CONFIRMED,
        couponId: "coup_1",
      };

      mockPrisma.order.findUnique.mockResolvedValue(confirmedCodOrder);
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
        ...confirmedCodOrder,
        status: OrderStatus.CANCELLED,
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { productVariantId: "var_1", quantity: 2 },
      ]);
      mockPrisma.coupon.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.productVariant.update.mockResolvedValue({});

      await service.transitionStatus("ord_cod_conf", OrderStatus.CANCELLED, "admin_1");

      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "ord_cod_conf",
          paymentMethod: PaymentMethod.COD,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
        },
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
        }),
      });

      expect(mockPrisma.coupon.updateMany).toHaveBeenCalledWith({
        where: { id: "coup_1", usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });

      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: "var_1" },
        data: { stock: { increment: 2 } },
      });
    });
  });

  describe("expirePendingReservations", () => {
    it("should not expire COD orders because reservationExpiresAt is null", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]); // No pending orders with reservationExpiresAt <= now

      const expiredCount = await service.expirePendingReservations();

      expect(expiredCount).toBe(0);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.PENDING,
          reservationExpiresAt: { lte: expect.any(Date) },
        },
        select: { id: true },
      });
    });
  });
});
