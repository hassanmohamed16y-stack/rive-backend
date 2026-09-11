import { BadRequestException } from "@nestjs/common";
import { ExcelService } from "./excel.service";

describe("ExcelService", () => {
  let service: ExcelService;
  let prisma: any;
  let auditLogService: any;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    auditLogService = {
      record: jest.fn().mockResolvedValue({}),
    };
    service = new ExcelService(prisma as any, auditLogService as any);
  });

  it("exports products as Buffer", async () => {
    const buffer = await service.exportProducts();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("exports orders as Buffer", async () => {
    const buffer = await service.exportOrders();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("throws BadRequestException when importing an invalid Excel buffer", async () => {
    const invalidBuffer = Buffer.from("not-an-excel-file");
    await expect(service.importProducts(invalidBuffer)).rejects.toBeInstanceOf(BadRequestException);
  });
});
