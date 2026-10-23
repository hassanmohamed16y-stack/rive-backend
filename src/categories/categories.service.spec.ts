import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";

describe("CategoriesService", () => {
  function createService() {
    const prisma = {
      category: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: "category-1", isFeatured: true, _count: { products: 0 } },
          ]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      product: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new CategoriesService(prisma as any, auditLogService as any),
      prisma,
      auditLogService,
    };
  }

  it("returns categories with pagination metadata", async () => {
    const { service, prisma } = createService();

    await expect(
      service.findAll(undefined, { page: 2, limit: 10 }),
    ).resolves.toEqual({
      data: [{ id: "category-1", isFeatured: true, _count: { products: 0 } }],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, where: {} }),
    );
  });

  it("filters featured categories using the same query-string pattern as products", async () => {
    const { service, prisma } = createService();

    await service.findAll({ isFeatured: "true" }, { page: 1, limit: 20 });

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isFeatured: true } }),
    );
    expect(prisma.category.count).toHaveBeenCalledWith({
      where: { isFeatured: true },
    });
  });

  it("maps a category foreign-key restriction to a safe conflict response", async () => {
    const { service, prisma } = createService();
    prisma.category.delete.mockRejectedValue({ code: "P2003" });

    await expect(service.remove("category-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  describe("remove", () => {
    it("blocks deletion while the category still has live products", async () => {
      const { service, prisma } = createService();
      prisma.product.count.mockResolvedValue(2);

      await expect(service.remove("category-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { categoryId: "category-1", deletedAt: null },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("purges already-deleted products and removes an otherwise empty category", async () => {
      const { service, prisma, auditLogService } = createService();
      prisma.category.delete.mockResolvedValue({ id: "category-1" });

      await service.remove("category-1", "admin-1");

      // hard delete via raw SQL so the soft-delete middleware can't intercept it
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [sqlParts, categoryId] = prisma.$executeRaw.mock.calls[0];
      expect(sqlParts.join("?")).toBe(
        'DELETE FROM "Product" WHERE "categoryId" = ? AND "deletedAt" IS NOT NULL',
      );
      expect(categoryId).toBe("category-1");
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: "category-1" },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "category.delete",
          changes: { deleted: true, movedProducts: 0 },
        }),
      );
    });

    it("keeps the category when hidden products have order history", async () => {
      const { service, prisma } = createService();
      prisma.$executeRaw.mockRejectedValue({
        code: "P2010",
        meta: { code: "23503" },
      });

      await expect(service.remove("category-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("moves every product to the chosen category and then deletes", async () => {
      const { service, prisma, auditLogService } = createService();
      prisma.category.findUnique.mockResolvedValue({ id: "category-2" });
      prisma.product.updateMany.mockResolvedValue({ count: 3 });
      prisma.category.delete.mockResolvedValue({ id: "category-1" });

      await service.remove("category-1", "admin-1", "category-2");

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "category-1" },
        data: { categoryId: "category-2" },
      });
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: "category-1" },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            deleted: true,
            movedProducts: 3,
            moveToCategoryId: "category-2",
          },
        }),
      );
    });

    it("rejects moving products into the category being deleted", async () => {
      const { service, prisma } = createService();

      await expect(
        service.remove("category-1", "admin-1", "category-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns not found when the target category does not exist", async () => {
      const { service, prisma } = createService();
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.remove("category-1", "admin-1", "missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });
  });

  it("throws ConflictException when creating a category with a duplicate name/slug (P2002)", async () => {
    const { service, prisma } = createService();
    prisma.category.create.mockRejectedValue({ code: "P2002" });

    const dto = { name: "Dresses", slug: "dresses" } as any;
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws ConflictException when updating a category to a duplicate name/slug (P2002)", async () => {
    const { service, prisma } = createService();
    prisma.category.update.mockRejectedValue({ code: "P2002" });

    await expect(
      service.update("category-1", { slug: "duplicate" } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
