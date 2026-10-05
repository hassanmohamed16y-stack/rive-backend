import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { AdminReviewsQueryDto } from "./admin-reviews-query.dto";
import { AdminReviewsController } from "../admin-reviews.controller";

describe("AdminReviewsQueryDto & AdminReviewsController", () => {
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
    it("converts string 'true' to boolean true", async () => {
      const result = await pipe.transform(
        { isApproved: "true", page: "1", limit: "20" },
        { type: "query", metatype: AdminReviewsQueryDto },
      );
      expect(result).toBeInstanceOf(AdminReviewsQueryDto);
      expect(result.isApproved).toBe(true);
    });

    it("converts string 'false' to boolean false (not true)", async () => {
      const result = await pipe.transform(
        { isApproved: "false" },
        { type: "query", metatype: AdminReviewsQueryDto },
      );
      expect(result.isApproved).toBe(false);
    });

    it("treats empty string isApproved as undefined", async () => {
      const result = await pipe.transform(
        { isApproved: "" },
        { type: "query", metatype: AdminReviewsQueryDto },
      );
      expect(result.isApproved).toBeUndefined();
    });

    it("rejects non-boolean string values (e.g. 'invalid', '1') with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { isApproved: "invalid" },
          { type: "query", metatype: AdminReviewsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { isApproved: "1" },
          { type: "query", metatype: AdminReviewsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("AdminReviewsController.findAll delegation", () => {
    it("verifies isApproved filter reaches reviewsService.findAllAdmin", async () => {
      const reviewsService = {
        findAllAdmin: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminReviewsController(reviewsService as any);

      const queryDto: AdminReviewsQueryDto = {
        isApproved: false,
        page: 1,
        limit: 10,
      };

      await controller.findAll(queryDto);

      expect(reviewsService.findAllAdmin).toHaveBeenCalledWith(false, {
        page: 1,
        limit: 10,
      });
    });
  });
});
