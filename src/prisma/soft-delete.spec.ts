import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";

describe("PrismaService Soft Delete Middleware", () => {
  let prismaService: PrismaService;
  let middlewareFn: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);

    // Mock $connect and $use
    jest.spyOn(prismaService, "$connect").mockResolvedValue(undefined);
    jest.spyOn(prismaService, "$use").mockImplementation((mw: any) => {
      middlewareFn = mw;
    });

    await prismaService.onModuleInit();
  });

  it("registers soft delete middleware on init", () => {
    expect(middlewareFn).toBeDefined();
  });

  it("converts delete to update with deletedAt for Product, Order, User", async () => {
    const next = jest.fn().mockResolvedValue({ id: "1", deletedAt: new Date() });

    const params = {
      model: "Product",
      action: "delete",
      args: { where: { id: "p-1" } },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "Product",
        action: "update",
        args: expect.objectContaining({
          where: { id: "p-1" },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it("converts deleteMany to updateMany with deletedAt for Order", async () => {
    const next = jest.fn().mockResolvedValue({ count: 2 });

    const params = {
      model: "Order",
      action: "deleteMany",
      args: { where: { userId: "u-1" } },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "Order",
        action: "updateMany",
        args: expect.objectContaining({
          where: { userId: "u-1" },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it("automatically adds deletedAt: null to findMany queries for User", async () => {
    const next = jest.fn().mockResolvedValue([]);

    const params = {
      model: "User",
      action: "findMany",
      args: { where: { role: "CUSTOMER" } },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "User",
        action: "findMany",
        args: {
          where: {
            role: "CUSTOMER",
            deletedAt: null,
          },
        },
      }),
    );
  });

  it("converts findUnique to findFirst with deletedAt: null", async () => {
    const next = jest.fn().mockResolvedValue({ id: "u-1" });

    const params = {
      model: "User",
      action: "findUnique",
      args: { where: { id: "u-1" } },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "User",
        action: "findFirst",
        args: {
          where: {
            id: "u-1",
            deletedAt: null,
          },
        },
      }),
    );
  });

  it("allows includeDeleted: true to query soft-deleted records", async () => {
    const next = jest.fn().mockResolvedValue([]);

    const params = {
      model: "Product",
      action: "findMany",
      args: { where: { status: "ACTIVE" }, includeDeleted: true },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "Product",
        action: "findMany",
        args: {
          where: { status: "ACTIVE" },
        },
      }),
    );
  });

  it("passes through queries for non-soft-delete models untouched", async () => {
    const next = jest.fn().mockResolvedValue([]);

    const params = {
      model: "Category",
      action: "findMany",
      args: { where: { isFeatured: true } },
    };

    await middlewareFn(params, next);

    expect(next).toHaveBeenCalledWith(params);
  });
});
