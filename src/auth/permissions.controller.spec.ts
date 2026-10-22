import { ConflictException } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";

describe("PermissionsService Tests", () => {
  let service: PermissionsService;
  let prismaMock: any;
  let auditLogMock: any;

  beforeEach(() => {
    prismaMock = {
      permission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      role: {
        findUnique: jest.fn(),
      },
      rolePermission: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    auditLogMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new PermissionsService(prismaMock, auditLogMock);
  });

  it("creates a permission and auto-links to full_admin", async () => {
    prismaMock.permission.findUnique.mockResolvedValue(null);
    prismaMock.permission.create.mockResolvedValue({
      id: "perm-10",
      key: "orders.delete",
      label: "حذف الطلبات",
      createdAt: new Date(),
    });
    prismaMock.role.findUnique.mockResolvedValue({
      id: "full-admin-role-id",
      name: "full_admin",
    });

    const result = await service.createPermission(
      { key: "orders.delete", name: "حذف الطلبات" },
      "admin-1",
    );

    expect(result.key).toBe("orders.delete");
    expect(prismaMock.rolePermission.create).toHaveBeenCalledWith({
      data: {
        roleId: "full-admin-role-id",
        permissionId: "perm-10",
      },
    });
    expect(auditLogMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "permission.created" }),
    );
  });

  it("throws conflict if permission key already exists", async () => {
    prismaMock.permission.findUnique.mockResolvedValue({
      id: "perm-1",
      key: "orders.view",
    });

    await expect(
      service.createPermission(
        { key: "orders.view", name: "عرض الطلبات" },
        "admin-1",
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("returns permissions grouped by department", async () => {
    const mockDate = new Date();
    prismaMock.permission.findMany.mockResolvedValue([
      { id: "1", key: "customers.view", label: "عرض العملاء", createdAt: mockDate },
      { id: "2", key: "orders.refund", label: "استرداد الأموال", createdAt: mockDate },
      { id: "3", key: "orders.view", label: "عرض الطلبات", createdAt: mockDate },
      { id: "4", key: "products.edit", label: "تعديل المنتجات", createdAt: mockDate },
    ]);

    const result = await service.findAllPermissionsGrouped();

    expect(result.orders.length).toBe(2);
    expect(result.customers.length).toBe(1);
    expect(result.products.length).toBe(1);
    expect(result.orders[0].key).toBe("orders.refund");
    expect(result.orders[1].key).toBe("orders.view");
  });

  it("creates missing built-in permissions (and grants them to full_admin) when the table is empty", async () => {
    prismaMock.permission.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }])
      .mockResolvedValueOnce([
        { id: "p1", key: "orders.view", label: "عرض الطلبات", createdAt: new Date() },
      ]);
    prismaMock.role.findUnique.mockResolvedValue({ id: "fa", name: "full_admin" });

    const result = await service.findAllPermissionsGrouped();

    const created = prismaMock.permission.createMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(created.data.map((d: any) => d.key)).toEqual(
      expect.arrayContaining(["orders.view", "stats.view", "suppliers.manage"]),
    );
    expect(prismaMock.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "fa", permissionId: "p1" },
        { roleId: "fa", permissionId: "p2" },
      ],
      skipDuplicates: true,
    });
    expect(result.orders).toHaveLength(1);
  });

  it("does not write anything when all built-in permissions already exist", async () => {
    const { DEFAULT_PERMISSIONS } = await import("./default-permissions");
    prismaMock.permission.findMany.mockResolvedValue(
      DEFAULT_PERMISSIONS.map((p, i) => ({ id: String(i), ...p, createdAt: new Date() })),
    );

    await service.findAllPermissionsGrouped();

    expect(prismaMock.permission.createMany).not.toHaveBeenCalled();
  });
});
