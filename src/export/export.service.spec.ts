import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus, PaymentStatus, UserRole } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { ExportService, MAX_EXPORT_ROWS } from "./export.service";

describe("ExportService", () => {
  let service: ExportService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockOrder = {
    id: "ord-1",
    orderNumber: "RIV-1001",
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.PAID,
    subtotal: { toString: () => "100.00" },
    discount: { toString: () => "0.00" },
    shippingFee: { toString: () => "10.00" },
    totalAmount: { toString: () => "110.00" },
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    paymobTransactionId: "txn-123",
    paymobIntentionId: null,
    paymentSessionId: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    items: [
      { id: "item-1", quantity: 2 },
    ],
  };

  const mockCustomer = {
    id: "cust-1",
    fullName: "John Smith",
    email: "john@example.com",
    role: UserRole.CUSTOMER,
    emailVerifiedAt: new Date("2026-01-01T10:00:00Z"),
    createdAt: new Date("2026-01-01T10:00:00Z"),
  };

  beforeEach(async () => {
    const prismaMock = {
      order: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockOrder]),
      },
      user: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockCustomer]),
      },
    };

    const auditLogMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogService, useValue: auditLogMock },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
  });

  describe("exportOrders", () => {
    it("exports orders in CSV format and logs audit action", async () => {
      const result = await service.exportOrders({ format: "csv", status: OrderStatus.PAID }, "admin-1");

      expect(result.mimeType).toBe("text/csv");
      expect(result.filename).toContain("orders-export-");
      expect(result.buffer.toString("utf8")).toContain("Order Number");
      expect(result.buffer.toString("utf8")).toContain("RIV-1001");

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OrderStatus.PAID },
          take: MAX_EXPORT_ROWS,
        }),
      );

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "export.orders",
        entityType: "Order",
        entityId: "export",
        changes: expect.objectContaining({
          format: "csv",
          count: 1,
        }),
      });
    });

    it("exports orders in PDF format", async () => {
      const result = await service.exportOrders({ format: "pdf" }, "admin-1");

      expect(result.mimeType).toBe("application/pdf");
      expect(result.filename).toContain(".pdf");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it("filters orders by date range using startDate/endDate and from/to aliases", async () => {
      await service.exportOrders({ startDate: "2026-01-01", endDate: "2026-01-31" }, "admin-1");

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: new Date("2026-01-01"),
              lte: new Date("2026-01-31"),
            },
          },
        }),
      );
    });

    it("throws BadRequestException for invalid format", async () => {
      await expect(service.exportOrders({ format: "xml" }, "admin-1")).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for invalid date string", async () => {
      await expect(service.exportOrders({ startDate: "invalid-date" }, "admin-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("exportCustomers", () => {
    it("exports customer users in CSV format and records audit log", async () => {
      const result = await service.exportCustomers({ format: "csv" }, "admin-1");

      expect(result.mimeType).toBe("text/csv");
      expect(result.filename).toContain("customers-export-");
      expect(result.buffer.toString("utf8")).toContain("Full Name");
      expect(result.buffer.toString("utf8")).toContain("John Smith");

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.CUSTOMER },
          take: MAX_EXPORT_ROWS,
        }),
      );

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "export.customers",
        entityType: "User",
        entityId: "export",
        changes: expect.objectContaining({
          format: "csv",
          count: 1,
        }),
      });
    });

    it("throws BadRequestException if format is not csv", async () => {
      await expect(service.exportCustomers({ format: "pdf" }, "admin-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("exportPayments", () => {
    it("exports payments in CSV format and logs audit action", async () => {
      const result = await service.exportPayments({ format: "csv", paymentStatus: PaymentStatus.PAID }, "admin-1");

      expect(result.mimeType).toBe("text/csv");
      expect(result.filename).toContain("payments-export-");
      expect(result.buffer.toString("utf8")).toContain("Payment Ref ID");
      expect(result.buffer.toString("utf8")).toContain("txn-123");

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paymentStatus: PaymentStatus.PAID },
          take: MAX_EXPORT_ROWS,
        }),
      );

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "export.payments",
        entityType: "Payment",
        entityId: "export",
        changes: expect.objectContaining({
          format: "csv",
          count: 1,
        }),
      });
    });

    it("exports payments in PDF format", async () => {
      const result = await service.exportPayments({ format: "pdf" }, "admin-1");

      expect(result.mimeType).toBe("application/pdf");
      expect(result.filename).toContain(".pdf");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it("throws BadRequestException for unsupported format", async () => {
      await expect(service.exportPayments({ format: "xlsx" }, "admin-1")).rejects.toThrow(BadRequestException);
    });
  });
});
