import { ConflictException, NotFoundException } from "@nestjs/common";
import { SystemListsService } from "./system-lists.service";

describe("SystemListsService", () => {
  function createService() {
    const prisma = {
      listType: {
        findMany: jest.fn().mockResolvedValue([
          { id: "lt-1", key: "product_category", label: "أقسام المنتجات", _count: { items: 2 } },
        ]),
        findUnique: jest.fn(),
      },
      listItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: "item-1", listTypeId: "lt-1", key: "clothing", labelAr: "ملابس", labelEn: "Clothing", sortOrder: 1, isActive: true },
        ]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    return {
      service: new SystemListsService(prisma as any, auditLogService as any),
      prisma,
      auditLogService,
    };
  }

  describe("findAllTypes", () => {
    it("returns all list types with item counts", async () => {
      const { service, prisma } = createService();
      const result = await service.findAllTypes();

      expect(result).toEqual([
        { id: "lt-1", key: "product_category", label: "أقسام المنتجات", _count: { items: 2 } },
      ]);
      expect(prisma.listType.findMany).toHaveBeenCalledWith({
        include: { _count: { select: { items: true } } },
        orderBy: { key: "asc" },
      });
    });
  });

  describe("findItemsByTypeKey", () => {
    it("returns active items by default for an existing list type", async () => {
      const { service, prisma } = createService();
      prisma.listType.findUnique.mockResolvedValue({ id: "lt-1", key: "product_category" });

      const items = await service.findItemsByTypeKey("product_category");

      expect(items).toHaveLength(1);
      expect(prisma.listItem.findMany).toHaveBeenCalledWith({
        where: { listTypeId: "lt-1", isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    });

    it("returns all items including inactive when includeInactive is true", async () => {
      const { service, prisma } = createService();
      prisma.listType.findUnique.mockResolvedValue({ id: "lt-1", key: "product_category" });

      await service.findItemsByTypeKey("product_category", true);

      expect(prisma.listItem.findMany).toHaveBeenCalledWith({
        where: { listTypeId: "lt-1" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    });

    it("throws NotFoundException if list type key does not exist", async () => {
      const { service, prisma } = createService();
      prisma.listType.findUnique.mockResolvedValue(null);

      await expect(
        service.findItemsByTypeKey("unknown_key"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("createItem", () => {
    it("creates a list item and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      prisma.listType.findUnique.mockResolvedValue({ id: "lt-1", key: "product_category" });
      const newItem = {
        id: "item-2",
        listTypeId: "lt-1",
        key: "shoes",
        labelAr: "أحذية",
        labelEn: "Shoes",
        sortOrder: 2,
        isActive: true,
      };
      prisma.listItem.create.mockResolvedValue(newItem);

      const dto = { key: "shoes", labelAr: "أحذية", labelEn: "Shoes", sortOrder: 2 };
      const created = await service.createItem("product_category", dto, "admin-user-1");

      expect(created).toEqual(newItem);
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "system_list_item.create",
        entityType: "ListItem",
        entityId: "item-2",
        changes: { listTypeKey: "product_category", ...dto },
      });
    });

    it("throws NotFoundException if list type does not exist", async () => {
      const { service, prisma } = createService();
      prisma.listType.findUnique.mockResolvedValue(null);

      await expect(
        service.createItem("unknown_key", { key: "shoes", labelAr: "أحذية" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ConflictException on duplicate key (P2002)", async () => {
      const { service, prisma } = createService();
      prisma.listType.findUnique.mockResolvedValue({ id: "lt-1", key: "product_category" });
      prisma.listItem.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.createItem("product_category", { key: "clothing", labelAr: "ملابس" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("updateItem", () => {
    it("updates a list item and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const updatedItem = {
        id: "item-1",
        listTypeId: "lt-1",
        key: "clothing_updated",
        labelAr: "ملابس حديثة",
        labelEn: "Modern Clothing",
        sortOrder: 5,
        isActive: true,
      };
      prisma.listItem.update.mockResolvedValue(updatedItem);

      const dto = { key: "clothing_updated", labelAr: "ملابس حديثة" };
      const result = await service.updateItem("item-1", dto, "admin-user-1");

      expect(result).toEqual(updatedItem);
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "system_list_item.update",
        entityType: "ListItem",
        entityId: "item-1",
        changes: dto,
      });
    });

    it("throws NotFoundException when item is not found (P2025)", async () => {
      const { service, prisma } = createService();
      prisma.listItem.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.updateItem("invalid-id", { labelAr: "test" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ConflictException on key conflict (P2002)", async () => {
      const { service, prisma } = createService();
      prisma.listItem.update.mockRejectedValue({ code: "P2002" });

      await expect(
        service.updateItem("item-1", { key: "existing_key" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("deactivateItem", () => {
    it("soft-deactivates an item (isActive=false) and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const deactivatedItem = {
        id: "item-1",
        listTypeId: "lt-1",
        key: "clothing",
        labelAr: "ملابس",
        isActive: false,
      };
      prisma.listItem.update.mockResolvedValue(deactivatedItem);

      const result = await service.deactivateItem("item-1", "admin-user-1");

      expect(result).toEqual(deactivatedItem);
      expect(prisma.listItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { isActive: false },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "system_list_item.deactivate",
        entityType: "ListItem",
        entityId: "item-1",
        changes: { isActive: false },
      });
    });

    it("throws NotFoundException when item is not found (P2025)", async () => {
      const { service, prisma } = createService();
      prisma.listItem.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.deactivateItem("invalid-id"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
