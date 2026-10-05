import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ProductStatus } from "@prisma/client";
import { AdminProductsQueryDto } from "./admin-products-query.dto";
import { AdminProductsController } from "../admin-products.controller";

describe("AdminProductsQueryDto & AdminProductsController", () => {
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
    it("accepts a valid ProductStatus enum value", async () => {
      const result = await pipe.transform(
        { status: "ACTIVE", page: "2", limit: "15" },
        { type: "query", metatype: AdminProductsQueryDto },
      );
      expect(result).toBeInstanceOf(AdminProductsQueryDto);
      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
    });

    it("treats empty string status as undefined", async () => {
      const result = await pipe.transform(
        { status: "" },
        { type: "query", metatype: AdminProductsQueryDto },
      );
      expect(result.status).toBeUndefined();
    });

    it("rejects an invalid ProductStatus enum value with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { status: "NOT_A_STATUS" },
          { type: "query", metatype: AdminProductsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("AdminProductsController.findAll delegation", () => {
    it("verifies the status filter reaches productsService.findAll", async () => {
      const productsService = {
        findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminProductsController(productsService as any);

      const queryDto: AdminProductsQueryDto = {
        status: ProductStatus.ARCHIVED,
        page: 1,
        limit: 20,
      };

      await controller.findAll(queryDto);

      expect(productsService.findAll).toHaveBeenCalledWith(
        { status: ProductStatus.ARCHIVED },
        { page: 1, limit: 20 },
        true,
      );
    });
  });
});
