import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PermissionsGuard } from "./permissions.guard";
import { UsersService } from "./users.service";

describe("PermissionsGuard & UsersService Security Tests", () => {
  describe("PermissionsGuard", () => {
    it("allows access when no permissions are required", () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(null),
      } as any;
      const guard = new PermissionsGuard(reflector);

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: { permissions: [] } }),
        }),
      } as any;

      expect(guard.canActivate(context)).toBe(true);
    });

    it("allows access when user possesses required permission", () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(["orders.refund"]),
      } as any;
      const guard = new PermissionsGuard(reflector);

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { permissions: ["orders.view", "orders.refund"] },
          }),
        }),
      } as any;

      expect(guard.canActivate(context)).toBe(true);
    });

    it("denies access when user lacks required permission", () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(["users.manage"]),
      } as any;
      const guard = new PermissionsGuard(reflector);

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { permissions: ["orders.view"] },
          }),
        }),
      } as any;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("UsersService Safety Rails", () => {
    let service: UsersService;
    let prismaMock: any;
    let auditLogMock: any;

    beforeEach(() => {
      prismaMock = {
        user: {
          findUnique: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
        role: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
      };
      auditLogMock = {
        record: jest.fn().mockResolvedValue(undefined),
      };
      service = new UsersService(prismaMock, auditLogMock);
    });

    it("prevents self-role modification", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "admin-1",
        roleId: "role-1",
        roleRecord: { name: "full_admin" },
      });

      await expect(
        service.updateUser("admin-1", { roleId: "role-2" }, { id: "admin-1" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("prevents disabling the last active Full Admin", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "admin-1",
        roleId: "role-full-admin",
        isActive: true,
        roleRecord: { name: "full_admin" },
      });

      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-full-admin",
        name: "full_admin",
      });

      prismaMock.user.count.mockResolvedValue(0);

      await expect(
        service.disableUser("admin-1", { id: "admin-2" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows disabling Full Admin if other active Full Admins remain", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "admin-1",
        roleId: "role-full-admin",
        isActive: true,
        roleRecord: { name: "full_admin" },
      });

      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-full-admin",
        name: "full_admin",
      });

      prismaMock.user.count.mockResolvedValue(1);

      prismaMock.user.update.mockResolvedValue({
        id: "admin-1",
        isActive: false,
        roleRecord: { name: "full_admin" },
      });

      const result = await service.disableUser("admin-1", { id: "admin-2" });
      expect(result.isActive).toBe(false);
      expect(auditLogMock.record).toHaveBeenCalled();
    });
  });
});
