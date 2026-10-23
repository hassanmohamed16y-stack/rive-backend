import { ConflictException } from "@nestjs/common";
import { CollectionsService } from "./collections.service";

describe("CollectionsService", () => {
  let service: CollectionsService;
  let prisma: any;
  let auditLogService: any;

  beforeEach(() => {
    prisma = {
      collection: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      productCollection: {
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    auditLogService = {
      record: jest.fn().mockResolvedValue({}),
    };
    service = new CollectionsService(prisma as any, auditLogService as any);
  });

  it("public views only include live, published products; admin view keeps drafts", async () => {
    const publicFilter = {
      deletedAt: null,
      status: { in: ["ACTIVE", "PUBLISHED"] },
    };

    await service.findAll({}, { page: 1, limit: 10 }, true);
    expect(prisma.collection.findMany.mock.calls[0][0].include.products.where).toEqual({
      product: publicFilter,
    });

    await service.findAll({}, { page: 1, limit: 10 });
    expect(prisma.collection.findMany.mock.calls[1][0].include.products.where).toEqual({
      product: { deletedAt: null },
    });

    prisma.collection.findUnique.mockResolvedValue({ id: "c1", products: [] });
    await service.findOneBySlug("summer");
    expect(prisma.collection.findUnique.mock.calls[0][0].include.products.where).toEqual({
      product: publicFilter,
    });
  });

  it("lists collections with pagination", async () => {
    prisma.collection.findMany.mockResolvedValue([
      { id: "col-1", name: "Summer Collection", slug: "summer-collection" },
    ]);
    prisma.collection.count.mockResolvedValue(1);

    const result = await service.findAll({}, { page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("creates a new collection successfully", async () => {
    prisma.collection.findFirst.mockResolvedValue(null);
    prisma.collection.create.mockResolvedValue({
      id: "col-1",
      name: "Luxury Silk",
      slug: "luxury-silk",
    });

    const result = await service.create(
      { name: "Luxury Silk", slug: "luxury-silk" },
      "admin-1",
    );
    expect(result.id).toBe("col-1");
    expect(auditLogService.record).toHaveBeenCalled();
  });

  it("prevents duplicate collection creation", async () => {
    prisma.collection.findFirst.mockResolvedValue({ id: "existing" });
    await expect(
      service.create({ name: "Luxury Silk", slug: "luxury-silk" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
