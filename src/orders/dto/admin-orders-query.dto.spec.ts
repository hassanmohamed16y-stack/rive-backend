import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
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
  });

  describe("AdminOrdersController.findAll delegation", () => {
    it("verifies the filter reaches ordersService.findAll", async () => {
      const ordersService = {
        findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminOrdersController(
        ordersService as any,
        {} as any,
      );

      const queryDto: AdminOrdersQueryDto = {
        status: OrderStatus.SHIPPED,
        page: 1,
        limit: 10,
      };

      await controller.findAll(queryDto);

      expect(ordersService.findAll).toHaveBeenCalledWith(
        { status: OrderStatus.SHIPPED },
        queryDto,
      );
    });
  });
});
