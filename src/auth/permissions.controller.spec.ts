import { ConflictException } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { PERMISSION_CATALOG } from "./permission-catalog";

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
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      role: {
        findUnique: jest.fn(),
      },
      rolePermission: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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

  const catalogRows = () =>
    PERMISSION_CATALOG.map((p, i) => ({
      id: `id-${i}`,
      key: p.key,
      label: p.label,
      createdAt: new Date(),
    }));

  it("returns permissions grouped by catalog group in catalog order", async () => {
    prismaMock.permission.findMany.mockResolvedValue(catalogRows());

    const result = await service.findAllPermissionsGrouped();

    expect(Object.keys(result)[0]).toBe("الإحصائيات");
    expect(result["الطلبات"].map((p) => p.key)).toEqual([
      "orders.view",
      "orders.update_status",
      "orders.refund",
      "orders.notes",
      "orders.export",
      "orders.delete",
    ]);
    expect(prismaMock.permission.createMany).not.toHaveBeenCalled();
  });

  it("puts custom (non-catalog) permissions under a general group", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      ...catalogRows(),
      { id: "x", key: "custom.thing", label: "مخصصة", createdAt: new Date() },
    ]);

    const result = await service.findAllPermissionsGrouped();

    expect(result["عام"]).toHaveLength(1);
  });

  it("creates the whole catalog and grants it to full_admin when the table is empty", async () => {
    prismaMock.permission.findMany
      .mockResolvedValueOnce([]) // initial list (empty table)
      .mockResolvedValueOnce(catalogRows()) // sync: all ids after create
      .mockResolvedValue(catalogRows()); // reload for the response
    prismaMock.role.findUnique.mockResolvedValue({ id: "fa", name: "full_admin" });

    await service.findAllPermissionsGrouped();

    const created = prismaMock.permission.createMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(created.data).toHaveLength(PERMISSION_CATALOG.length);
    const grant = prismaMock.rolePermission.createMany.mock.calls.at(-1)[0];
    expect(grant.data).toHaveLength(PERMISSION_CATALOG.length);
    expect(grant.data.every((d: any) => d.roleId === "fa")).toBe(true);
  });

  it("does nothing when every catalog permission already exists", async () => {
    prismaMock.permission.findMany.mockResolvedValue(catalogRows());

    const changed = await service.syncPermissionCatalog();

    expect(changed).toBe(false);
    expect(prismaMock.permission.createMany).not.toHaveBeenCalled();
    expect(prismaMock.rolePermission.createMany).not.toHaveBeenCalled();
  });

  describe("migrating roles from the old coarse permissions", () => {
    const legacy = (key: string) => ({ id: `old-${key}`, key });

    it("expands legacy permissions for the roles that hold them, then deletes the legacy rows", async () => {
      const rows = catalogRows();
      prismaMock.permission.findMany
        .mockResolvedValueOnce([legacy("content.manage"), legacy("products.edit"), { id: "ov", key: "orders.view" }])
        .mockResolvedValueOnce([...rows, legacy("content.manage"), legacy("products.edit")]);
      prismaMock.rolePermission.findMany.mockResolvedValue([
        { roleId: "r-content", permission: { key: "content.manage" } },
      ]);
      prismaMock.role.findUnique.mockResolvedValue(null);

      await service.syncPermissionCatalog();

      const grants = prismaMock.rolePermission.createMany.mock.calls[0][0].data;
      const grantedKeys = grants.map((g: any) => rows.find((r) => r.id === g.permissionId)?.key);
      expect(grants.every((g: any) => g.roleId === "r-content")).toBe(true);
      expect(grantedKeys).toEqual(
        expect.arrayContaining(["banners.view", "banners.create", "banners.edit", "banners.delete", "pages.edit", "media.upload"]),
      );
      // a content.manage role must NOT gain product or coupon access
      expect(grantedKeys).not.toContain("products.create");
      expect(grantedKeys).not.toContain("coupons.view");
      expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { permissionId: { in: ["old-content.manage"] } },
      });
      expect(prismaMock.permission.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["old-content.manage"] } },
      });
    });

    it("gives roles that kept products.view / orders.view their related permissions", async () => {
      const rows = catalogRows().filter((r) => r.key !== "reviews.view" && r.key !== "orders.export");
      const reviews = { id: "rv", key: "reviews.view" };
      prismaMock.permission.findMany
        .mockResolvedValueOnce([...rows.map((r) => ({ id: r.id, key: r.key }))])
        .mockResolvedValueOnce([...rows.map((r) => ({ id: r.id, key: r.key })), reviews, { id: "oe", key: "orders.export" }]);
      prismaMock.rolePermission.findMany.mockResolvedValue([
        { roleId: "r-view", permission: { key: "products.view" } },
        { roleId: "r-view", permission: { key: "orders.view" } },
      ]);
      prismaMock.role.findUnique.mockResolvedValue(null);

      await service.syncPermissionCatalog();

      const grants = prismaMock.rolePermission.createMany.mock.calls[0][0].data;
      expect(grants.map((g: any) => g.permissionId)).toEqual(expect.arrayContaining(["rv", "oe"]));
    });

    it("does not re-grant related read permissions once the split has already happened", async () => {
      const rows = catalogRows().filter((r) => r.key !== "coupons.delete");
      prismaMock.permission.findMany
        .mockResolvedValueOnce(rows.map((r) => ({ id: r.id, key: r.key })))
        .mockResolvedValueOnce(catalogRows().map((r) => ({ id: r.id, key: r.key })));
      prismaMock.role.findUnique.mockResolvedValue(null);

      await service.syncPermissionCatalog();

      // only the single missing key is created; no role migration queries at all
      expect(prismaMock.rolePermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.permission.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ key: "coupons.delete" }),
      ]);
    });
  });
});
