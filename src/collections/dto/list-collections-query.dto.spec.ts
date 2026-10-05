import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ListCollectionsQueryDto } from "./list-collections-query.dto";
import { AdminCollectionsController } from "../admin-collections.controller";
import { CollectionsController } from "../collections.controller";

describe("ListCollectionsQueryDto & Collections Controllers", () => {
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
    it("accepts search string and converts isFeatured 'true'/'false'", async () => {
      const resTrue = await pipe.transform(
        { search: "summer", isFeatured: "true" },
        { type: "query", metatype: ListCollectionsQueryDto },
      );
      expect(resTrue).toBeInstanceOf(ListCollectionsQueryDto);
      expect(resTrue.search).toBe("summer");
      expect(resTrue.isFeatured).toBe(true);

      const resFalse = await pipe.transform(
        { isFeatured: "false" },
        { type: "query", metatype: ListCollectionsQueryDto },
      );
      expect(resFalse.isFeatured).toBe(false);
    });

    it("treats empty string query params as undefined", async () => {
      const result = await pipe.transform(
        { search: "", isFeatured: "" },
        { type: "query", metatype: ListCollectionsQueryDto },
      );
      expect(result.search).toBeUndefined();
      expect(result.isFeatured).toBeUndefined();
    });

    it("rejects invalid boolean for isFeatured with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { isFeatured: "maybe" },
          { type: "query", metatype: ListCollectionsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("Controllers delegation", () => {
    it("verifies filters reach collectionsService.findAll in AdminCollectionsController", async () => {
      const collectionsService = {
        findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminCollectionsController(collectionsService as any);

      const queryDto: ListCollectionsQueryDto = {
        search: "winter",
        isFeatured: true,
        page: 1,
        limit: 10,
      };

      await controller.findAll(queryDto);

      expect(collectionsService.findAll).toHaveBeenCalledWith(
        { search: "winter", isFeatured: true },
        { page: 1, limit: 10 },
      );
    });

    it("verifies filters reach collectionsService.findAll in Public CollectionsController", async () => {
      const collectionsService = {
        findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new CollectionsController(collectionsService as any);

      const queryDto: ListCollectionsQueryDto = {
        search: "spring",
        isFeatured: false,
        page: 2,
        limit: 5,
      };

      await controller.findAll(queryDto);

      expect(collectionsService.findAll).toHaveBeenCalledWith(
        { search: "spring", isFeatured: false },
        { page: 2, limit: 5 },
      );
    });
  });
});
