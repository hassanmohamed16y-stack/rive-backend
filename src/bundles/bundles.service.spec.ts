import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { BundlesService } from "./bundles.service";

describe("BundlesService", () => {
  let service: BundlesService;

  const mockPrismaService = {
    bundle: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundlesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<BundlesService>(BundlesService);
    jest.clearAllMocks();
  });

  it("should create a bundle", async () => {
    const dto = { name: "Silk Bundle", productIds: ["p1", "p2"], bundlePrice: 400 };
    mockPrismaService.bundle.create.mockResolvedValue({ id: "b1", ...dto, isActive: true });

    const result = await service.create(dto, "admin1");
    expect(result.id).toBe("b1");
    expect(mockAuditLogService.record).toHaveBeenCalled();
  });
});
