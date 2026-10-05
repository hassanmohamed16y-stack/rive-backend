import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { UsersQueryDto } from "./users-query.dto";
import { UsersController } from "../users.controller";

describe("UsersQueryDto & UsersController", () => {
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
    it("accepts valid search and roleId query parameters", async () => {
      const result = await pipe.transform(
        { search: "alice", roleId: "role-123", page: "1", limit: "10" },
        { type: "query", metatype: UsersQueryDto },
      );
      expect(result).toBeInstanceOf(UsersQueryDto);
      expect(result.search).toBe("alice");
      expect(result.roleId).toBe("role-123");
    });

    it("treats empty string params as undefined", async () => {
      const result = await pipe.transform(
        { search: "", roleId: "" },
        { type: "query", metatype: UsersQueryDto },
      );
      expect(result.search).toBeUndefined();
      expect(result.roleId).toBeUndefined();
    });

    it("rejects search parameter exceeding max length (200 chars) with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { search: "a".repeat(201) },
          { type: "query", metatype: UsersQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("UsersController.findAll delegation", () => {
    it("verifies filters reach usersService.findAllUsers", async () => {
      const usersService = {
        findAllUsers: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new UsersController(usersService as any);

      const queryDto: UsersQueryDto = {
        search: "bob",
        roleId: "role-staff",
        page: 1,
        limit: 15,
      };

      await controller.findAll(queryDto);

      expect(usersService.findAllUsers).toHaveBeenCalledWith(
        { page: 1, limit: 15 },
        "bob",
        "role-staff",
      );
    });
  });
});
