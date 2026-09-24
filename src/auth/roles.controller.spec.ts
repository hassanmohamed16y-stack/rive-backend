import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { FullAdminGuard } from "./full-admin.guard";
import { RolesService } from "./roles.service";

describe("Roles & Permissions Dynamic RBAC Tests", () => {
  describe("FullAdminGuard", () => {
    let guard: FullAdminGuard;

    beforeEach(() => {
      guard = new FullAdminGuard();
    });

    it("allows access for full_admin user", () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: "admin-1", roleName: "full_admin" },
          }),
        }),
      } as any;

      expect(guard.canActivate(context)).toBe(true);
    });

    it("denies access for non-full_admin user", () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: "staff-1", roleName: "sales" },
          }),
        }),
      } as any;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("denies access when no user context exists", () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as any;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("RolesService", () => {
    let service: RolesService;
    let prismaMock: any;
    let auditLogMock: any;

    beforeEach(() => {
      prismaMock = {
        role: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        permission: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        rolePermission: {
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        user: {
          count: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(prismaMock)),
      };
      auditLogMock = {
        record: jest.fn().mockResolvedValue(undefined),
      };

      service = new RolesService(prismaMock, auditLogMock);
    });

    it("creates a new role successfully", async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);
      prismaMock.role.create.mockResolvedValue({
        id: "role-1",
        name: "inventory_manager",
        label: "مدير المخزون",
      });
      prismaMock.role.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "role-1",
          name: "inventory_manager",
          label: "مدير المخزون",
          createdAt: new Date(),
          permissions: [],
        });

      const result = await service.createRole(
        { name: "inventory_manager", label: "مدير المخزون" },
        "admin-1",
      );

      expect(result.name).toBe("inventory_manager");
      expect(auditLogMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "role.created" }),
      );
    });

    it("rejects role creation if role name exists", async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: "role-1", name: "sales" });

      await expect(
        service.createRole(
          { name: "sales", label: "مبيعات" },
          "admin-1",
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects deleting role if users are assigned to it", async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: "role-sales", name: "sales" });
      prismaMock.user.count.mockResolvedValue(3);

      await expect(service.deleteRole("role-sales", "admin-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects deleting full_admin role", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-admin",
        name: "full_admin",
      });

      await expect(service.deleteRole("role-admin", "admin-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deletes role when no users are assigned", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-temp",
        name: "temp_role",
      });
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.role.delete.mockResolvedValue({});

      const result = await service.deleteRole("role-temp", "admin-1");
      expect(result.message).toContain("deleted successfully");
      expect(auditLogMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "role.deleted" }),
      );
    });

    it("replaces role permissions via setRolePermissions", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "custom_role",
      });
      prismaMock.permission.findMany.mockResolvedValue([
        { id: "perm-1", key: "orders.view" },
        { id: "perm-2", key: "orders.refund" },
      ]);
      prismaMock.role.findUnique
        .mockResolvedValueOnce({ id: "role-1", name: "custom_role" })
        .mockResolvedValueOnce({
          id: "role-1",
          name: "custom_role",
          label: "Custom",
          createdAt: new Date(),
          permissions: [
            { permission: { id: "perm-1", key: "orders.view", label: "عرض الطلبات" } },
            { permission: { id: "perm-2", key: "orders.refund", label: "استرداد" } },
          ],
        });

      const result = await service.setRolePermissions(
        "role-1",
        { permissions: ["orders.view", "orders.refund"] },
        "admin-1",
      );

      expect(result.permissions.length).toBe(2);
      expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(prismaMock.rolePermission.createMany).toHaveBeenCalled();
    });
  });
});
