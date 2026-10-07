import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { OrderStatus, PaymentMethod, PaymentStatus, Size } from "@prisma/client";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";

describe("Guest Order Tracking & Mandatory Phone Validation", () => {
  let mockPrisma: any;
  let mockAuditLogService: any;
  let service: OrdersService;
  let controller: OrdersController;

  const mockOrder = {
    id: "ord-100",
    orderNumber: "RIV-12345678-ABCD",
    userId: "user-999",
    guestAccessToken: "secret-guest-token",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    shippingAddress: "456 Private Street, Apt 7",
    shippingPhone: "+201000000000",
    shippingCity: "Cairo",
    shippingCountry: "Egypt",
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: PaymentMethod.ONLINE,
    createdAt: new Date("2026-03-01T12:00:00Z"),
    totalAmount: "350.00",
    shippingFee: "50.00",
    codFee: "0.00",
    carrier: "Aramex",
    trackingNumber: "ARX987654321",
    trackingUrl: "https://aramex.com/track/ARX987654321",
    items: [
      {
        id: "item-1",
        quantity: 2,
        unitPrice: "150.00",
        totalPrice: "300.00",
        productVariant: {
          size: Size.M,
          product: {
            name: "Silk Evening Gown",
          },
        },
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      shippingZone: {
        findMany: jest.fn(),
      },
      siteSettings: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockAuditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(mockPrisma, mockAuditLogService);
    controller = new OrdersController(service);
  });

  describe("POST /api/v1/orders/track - Phone normalization & successful match", () => {
    it("successfully tracks order using +20 format phone", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: "RIV-12345678-ABCD",
        phone: "+201000000000",
      });

      expect(result.orderNumber).toBe("RIV-12345678-ABCD");
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.shippingCity).toBe("Cairo");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        productName: "Silk Evening Gown",
        size: Size.M,
        quantity: 2,
        price: "150.00",
        unitPrice: "150.00",
        totalPrice: "300.00",
      });
    });

    it("successfully tracks order matching phone with 0020 prefix", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: "RIV-12345678-ABCD",
        phone: "00201000000000",
      });

      expect(result.orderNumber).toBe("RIV-12345678-ABCD");
    });

    it("successfully tracks order matching phone with 20 prefix", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: "RIV-12345678-ABCD",
        phone: "201000000000",
      });

      expect(result.orderNumber).toBe("RIV-12345678-ABCD");
    });

    it("successfully tracks order matching phone with leading 0 (010...)", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: "RIV-12345678-ABCD",
        phone: "01000000000",
      });

      expect(result.orderNumber).toBe("RIV-12345678-ABCD");
    });

    it("successfully tracks order matching phone with spaces and dashes", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: "RIV-12345678-ABCD",
        phone: "+20 100-000-0000",
      });

      expect(result.orderNumber).toBe("RIV-12345678-ABCD");
    });
  });

  describe("POST /api/v1/orders/track - Error paths & privacy (indistinguishable 404 responses)", () => {
    it("returns HTTP 404 'Order not found' when phone does not match", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.trackOrder({
          orderNumber: "RIV-12345678-ABCD",
          phone: "01199998888", // different valid Egyptian phone
        }),
      ).rejects.toThrow(new NotFoundException("Order not found"));

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "order.track_failed",
          entityId: "RIV-12345678-ABCD",
          changes: { phoneLast3: "***888" },
        }),
      );
    });

    it("returns HTTP 404 'Order not found' when order does not exist", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.trackOrder({
          orderNumber: "RIV-UNKNOWN",
          phone: "01000000000",
        }),
      ).rejects.toThrow(new NotFoundException("Order not found"));

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "order.track_failed",
          entityId: "RIV-UNKNOWN",
          changes: { phoneLast3: "***000" },
        }),
      );
    });

    it("returns HTTP 404 'Order not found' when order in DB has missing/null shippingPhone", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        shippingPhone: null,
      });

      await expect(
        service.trackOrder({
          orderNumber: "RIV-12345678-ABCD",
          phone: "01000000000",
        }),
      ).rejects.toThrow(new NotFoundException("Order not found"));
    });

    it("returns HTTP 404 'Order not found' when input phone is invalid format", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.trackOrder({
          orderNumber: "RIV-12345678-ABCD",
          phone: "invalid-phone",
        }),
      ).rejects.toThrow(new NotFoundException("Order not found"));
    });
  });

  describe("POST /api/v1/orders/track - Field masking & privacy checks", () => {
    it("strictly excludes sensitive fields from the tracking response", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result: any = await controller.track({
        orderNumber: "RIV-12345678-ABCD",
        phone: "01000000000",
      });

      // Forbidden fields:
      expect(result.shippingAddress).toBeUndefined();
      expect(result.customerEmail).toBeUndefined();
      expect(result.customerName).toBeUndefined();
      expect(result.shippingPhone).toBeUndefined();
      expect(result.guestAccessToken).toBeUndefined();
      expect(result.userId).toBeUndefined();

      // Allowed fields:
      expect(result).toHaveProperty("orderNumber", "RIV-12345678-ABCD");
      expect(result).toHaveProperty("status", OrderStatus.CONFIRMED);
      expect(result).toHaveProperty("paymentStatus", PaymentStatus.PAID);
      expect(result).toHaveProperty("paymentMethod", PaymentMethod.ONLINE);
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("totalAmount", "350.00");
      expect(result).toHaveProperty("shippingFee", "50.00");
      expect(result).toHaveProperty("codFee", "0.00");
      expect(result).toHaveProperty("carrier", "Aramex");
      expect(result).toHaveProperty("trackingNumber", "ARX987654321");
      expect(result).toHaveProperty("trackingUrl", "https://aramex.com/track/ARX987654321");
      expect(result).toHaveProperty("shippingCity", "Cairo");
      expect(result).toHaveProperty("items");
    });
  });

  describe("POST /api/v1/orders/track - Throttling & rate limiting", () => {
    it("enforces smaller limit per orderNumber (max 3 attempts per minute per orderNumber)", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      const uniqueOrderNo = `RIV-RATE-LIMIT-${Date.now()}`;

      // 3 allowed calls
      await service.trackOrder({ orderNumber: uniqueOrderNo, phone: "01000000000" });
      await service.trackOrder({ orderNumber: uniqueOrderNo, phone: "01000000000" });
      await service.trackOrder({ orderNumber: uniqueOrderNo, phone: "01000000000" });

      // 4th call exceeds per-orderNumber rate limit
      await expect(
        service.trackOrder({ orderNumber: uniqueOrderNo, phone: "01000000000" }),
      ).rejects.toBeInstanceOf(ThrottlerException);
    });
  });

  describe("POST /orders - Mandatory shippingPhone for ONLINE orders", () => {
    const validVariant = {
      id: "var-1",
      price: "100",
      stock: 5,
      isAvailable: true,
      product: { status: "ACTIVE" },
    };
    const validZone = { id: "z-1", cityLabel: "Cairo", price: "30", isActive: true };

    it("rejects online order creation when shippingPhone is missing or empty", async () => {
      await expect(
        service.create({
          customerName: "Alice",
          customerEmail: "alice@example.com",
          shippingCity: "Cairo",
          shippingPhone: "   ",
          paymentMethod: PaymentMethod.ONLINE,
          items: [{ productVariantId: "var-1", quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects online order creation when shippingPhone is an invalid Egyptian number", async () => {
      await expect(
        service.create({
          customerName: "Alice",
          customerEmail: "alice@example.com",
          shippingCity: "Cairo",
          shippingPhone: "01999999999", // 019 is invalid
          paymentMethod: PaymentMethod.ONLINE,
          items: [{ productVariantId: "var-1", quantity: 1 }],
        }),
      ).rejects.toThrow("Invalid Egyptian phone number");
    });

    it("creates online order with normalized shippingPhone when phone is valid", async () => {
      mockPrisma.productVariant.findMany.mockResolvedValue([validVariant]);
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.shippingZone.findMany.mockResolvedValue([validZone]);
      mockPrisma.siteSettings.findUnique.mockResolvedValue({ id: "default" });
      mockPrisma.order.create.mockResolvedValue({
        id: "ord-online-1",
        orderNumber: "RIV-ONLINE-1",
        shippingPhone: "+201012345678",
      });

      await service.create({
        customerName: "Alice",
        customerEmail: "alice@example.com",
        shippingCity: "Cairo",
        shippingPhone: "01012345678",
        paymentMethod: PaymentMethod.ONLINE,
        items: [{ productVariantId: "var-1", quantity: 1 }],
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingPhone: "+201012345678",
          }),
        }),
      );
    });
  });
});
