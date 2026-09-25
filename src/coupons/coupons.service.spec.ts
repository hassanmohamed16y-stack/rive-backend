import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { CouponsService } from "./coupons.service";

describe("CouponsService", () => {
  let service: CouponsService;

  const mockPrismaService = {
    coupon: {
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
        CouponsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
  });

  it("should validate active percentage coupon", async () => {
    mockPrismaService.coupon.findUnique.mockResolvedValue({
      id: "c1",
      code: "SUMMER20",
      type: "PERCENTAGE",
      value: { toNumber: () => 20 },
      isActive: true,
      expiresAt: null,
      usageLimit: null,
      usageCount: 0,
      minOrderAmount: null,
    });

    const result = await service.validateCoupon("SUMMER20", 500);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
  });

  it("should reject expired coupon", async () => {
    mockPrismaService.coupon.findUnique.mockResolvedValue({
      id: "c1",
      code: "EXPIRED",
      type: "PERCENTAGE",
      value: { toNumber: () => 20 },
      isActive: true,
      expiresAt: new Date(Date.now() - 86400000),
      usageLimit: null,
      usageCount: 0,
      minOrderAmount: null,
    });

    await expect(service.validateCoupon("EXPIRED", 500)).rejects.toThrow(
      BadRequestException,
    );
  });
});
