import { AdminDashboardService } from "./admin-dashboard.service";

describe("AdminDashboardService", () => {
  let service: AdminDashboardService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      order: {
        count: jest.fn().mockResolvedValue(10),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: { toNumber: () => 5000 }, discount: { toNumber: () => 200 } },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      user: {
        count: jest.fn().mockResolvedValue(25),
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: {
        count: jest.fn().mockResolvedValue(50),
      },
      productVariant: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AdminDashboardService(prisma as any);
  });

  it("returns aggregated overview statistics correctly", async () => {
    const overview = await service.getOverviewStats();
    expect(overview.ordersCount).toBe(10);
    expect(overview.customersCount).toBe(25);
    expect(overview.productsCount).toBe(50);
    expect(overview.revenue).toBe(5000);
    expect(overview.discounts).toBe(200);
  });

  it("returns sales report", async () => {
    const report = await service.getSalesReport();
    expect(report.overview.ordersCount).toBe(10);
    expect(report).toHaveProperty("generatedAt");
  });
});
