import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { AdminMetaConversationsQueryDto } from "./admin-meta-conversations-query.dto";
import { AdminMetaController } from "../admin-meta.controller";

describe("AdminMetaConversationsQueryDto & AdminMetaController", () => {
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
    it("accepts valid platform, status, and search query parameters", async () => {
      const result = await pipe.transform(
        {
          platform: "facebook",
          status: "open",
          search: "john",
          page: "1",
          limit: "10",
        },
        { type: "query", metatype: AdminMetaConversationsQueryDto },
      );
      expect(result).toBeInstanceOf(AdminMetaConversationsQueryDto);
      expect(result.platform).toBe("facebook");
      expect(result.status).toBe("open");
      expect(result.search).toBe("john");
    });

    it("treats empty strings as undefined", async () => {
      const result = await pipe.transform(
        { platform: "", status: "", search: "" },
        { type: "query", metatype: AdminMetaConversationsQueryDto },
      );
      expect(result.platform).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.search).toBeUndefined();
    });

    it("rejects search parameter exceeding max length (200 chars) with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { search: "a".repeat(201) },
          { type: "query", metatype: AdminMetaConversationsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("AdminMetaController.getConversations delegation", () => {
    it("verifies filters reach metaService.findAllConversations", async () => {
      const metaService = {
        findAllConversations: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminMetaController(metaService as any);

      const queryDto: AdminMetaConversationsQueryDto = {
        platform: "instagram",
        status: "closed",
        search: "customer",
        page: 1,
        limit: 20,
      };

      await controller.getConversations(queryDto);

      expect(metaService.findAllConversations).toHaveBeenCalledWith(
        { platform: "instagram", status: "closed", search: "customer" },
        { page: 1, limit: 20 },
      );
    });
  });
});
