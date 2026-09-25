import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    order: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: { toNumber: () => 15000 } }, _count: 10 }),
      count: jest.fn().mockResolvedValue(10),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderItem: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    cartSession: {
      count: jest.fn().mockResolvedValue(20),
    },
    productVariant: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it("should calculate 30-day analytics overview", async () => {
    const res = await service.getOverview();
    expect(res.totalSales30Days).toBe(15000);
    expect(res.conversionRatePercent).toBeDefined();
  });
});
