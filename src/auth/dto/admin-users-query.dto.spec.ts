import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { AdminUsersQueryDto } from "./admin-users-query.dto";
import { AdminUsersController } from "../admin-users.controller";

describe("AdminUsersQueryDto & AdminUsersController", () => {
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
    it("accepts valid search and role query parameters", async () => {
      const result = await pipe.transform(
        { search: "john@example.com", role: "ADMIN", page: "1", limit: "10" },
        { type: "query", metatype: AdminUsersQueryDto },
      );
      expect(result).toBeInstanceOf(AdminUsersQueryDto);
      expect(result.search).toBe("john@example.com");
      expect(result.role).toBe("ADMIN");
    });

    it("treats empty string params as undefined", async () => {
      const result = await pipe.transform(
        { search: "", role: "" },
        { type: "query", metatype: AdminUsersQueryDto },
      );
      expect(result.search).toBeUndefined();
      expect(result.role).toBeUndefined();
    });

    it("rejects search parameter exceeding max length (200 chars) with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { search: "a".repeat(201) },
          { type: "query", metatype: AdminUsersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("AdminUsersController.findAll delegation", () => {
    it("verifies filters reach authService.findAllUsers", async () => {
      const authService = {
        findAllUsers: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new AdminUsersController(authService as any);

      const queryDto: AdminUsersQueryDto = {
        search: "admin",
        role: "ADMIN",
        page: 1,
        limit: 20,
      };

      await controller.findAll(queryDto);

      expect(authService.findAllUsers).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        "admin",
        "ADMIN",
      );
    });
  });
});
