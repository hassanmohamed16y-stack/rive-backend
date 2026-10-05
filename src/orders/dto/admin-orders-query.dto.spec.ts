import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { AdminOrdersQueryDto } from "./admin-orders-query.dto";
import { AdminOrdersController } from "../admin-orders.controller";

describe("AdminOrdersQueryDto & AdminOrdersController", () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
    });
  });

  describe("ValidationPipe DTO transformation", () => {
    it("accepts a valid OrderStatus enum value", async () => {
      const result = await pipe.transform(
        { status: "DELIVERED", page: "1", limit: "20" },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(result).toBeInstanceOf(AdminOrdersQueryDto);
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it("treats empty string status as undefined", async () => {
      const result = await pipe.transform(
        { status: "" },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(result.status).toBeUndefined();
    });

    it("rejects an invalid status enum value with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { status: "INVALID_STATUS" },
          { type: "query", metatype: AdminOrdersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts valid paymentStatus enum values", async () => {
      const result = await pipe.transform(
        { paymentStatus: "PAID" },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it("rejects an invalid paymentStatus enum value", async () => {
      await expect(
        pipe.transform(
          { paymentStatus: "INVALID_PAYMENT_STATUS" },
          { type: "query", metatype: AdminOrdersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("trims search term and treats whitespace string as undefined", async () => {
      const resultWithText = await pipe.transform(
        { search: "  RIV-1234  " },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(resultWithText.search).toBe("RIV-1234");

      const resultEmpty = await pipe.transform(
        { search: "   " },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(resultEmpty.search).toBeUndefined();
    });

    it("rejects search string longer than 100 characters", async () => {
      const longSearch = "a".repeat(101);
      await expect(
        pipe.transform(
          { search: longSearch },
          { type: "query", metatype: AdminOrdersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts valid ISO date strings for startDate and endDate", async () => {
      const result = await pipe.transform(
        { startDate: "2026-01-01", endDate: "2026-01-31" },
        { type: "query", metatype: AdminOrdersQueryDto },
      );
      expect(result.startDate).toBe("2026-01-01");
      expect(result.endDate).toBe("2026-01-31");
    });

    it("rejects invalid date string formats", async () => {
      await expect(
        pipe.transform(
          { startDate: "not-a-valid-date" },
          { type: "query", metatype: AdminOrdersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when startDate is later than endDate with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { startDate: "2026-05-10", endDate: "2026-05-01" },
          { type: "query", metatype: AdminOrdersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("AdminOrdersController.findAll delegation", () => {
    it("verifies all filter fields reach ordersService.findAll", async () => {
      const ordersService = {
        findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminOrdersController(
        ordersService as any,
        {} as any,
      );

      const queryDto: AdminOrdersQueryDto = {
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        search: "john",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        page: 1,
        limit: 10,
      };

      await controller.findAll(queryDto);

      expect(ordersService.findAll).toHaveBeenCalledWith(queryDto, queryDto);
    });
  });
});
