import { BadRequestException } from "@nestjs/common";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { PaymobService } from "./paymob.service";

describe("PaymobService COD Integration", () => {
  let service: PaymobService;
  let mockPrisma: any;
  let mockOrdersService: any;
  let mockAuditLogService: any;

  beforeEach(() => {
    process.env.PAYMOB_HMAC_SECRET = "test_hmac_secret";
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      processedPaymobEvent: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockOrdersService = {
      expireOrder: jest.fn().mockResolvedValue(undefined),
      markPaidInTransaction: jest.fn(),
      cancelPendingOrderInTransaction: jest.fn(),
    };

    mockAuditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new PaymobService(
      mockPrisma,
      mockOrdersService as any,
      mockAuditLogService as any,
      undefined,
    );
  });

  describe("createCheckoutSession", () => {
    it("should reject COD orders with BadRequestException", async () => {
      const codOrder = {
        id: "ord_cod_1",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.PENDING,
        reservationExpiresAt: null,
      };

      mockPrisma.order.findUnique.mockResolvedValue(codOrder);

      await expect(
        service.createCheckoutSession("ord_cod_1"),
      ).rejects.toThrow(
        new BadRequestException("COD orders cannot be processed via Paymob"),
      );
    });
  });

  describe("handleWebhook", () => {
    it("should ignore webhook for COD orders without updating order status", async () => {
      const payload = {
        type: "TRANSACTION",
        obj: {
          id: 123456,
          success: true,
          pending: false,
          special_reference: "ord_cod_1",
        },
      };

      jest.spyOn(service, "calculateHmac").mockReturnValue("valid_hmac");

      mockPrisma.order.findUnique.mockResolvedValue({
        id: "ord_cod_1",
        paymentMethod: PaymentMethod.COD,
        status: OrderStatus.PENDING,
      });

      const result = await service.handleWebhook(payload, "valid_hmac");

      expect(result).toEqual({
        received: true,
        orderId: "ord_cod_1",
        message: "Paymob webhook ignored for COD order",
      });

      expect(mockOrdersService.markPaidInTransaction).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "payment.paymob_webhook_ignored_cod",
            entityId: "ord_cod_1",
          }),
        }),
      );
    });
  });

  describe("reconcilePayments", () => {
    it("should exclude COD orders from reconciliation query", async () => {
      process.env.PAYMOB_API_KEY = "test_key";
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.reconcilePayments(2, false);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentMethod: { not: PaymentMethod.COD },
          }),
        }),
      );
    });
  });
});
