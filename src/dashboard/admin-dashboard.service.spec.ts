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

  it("builds a zero-filled daily chart for the requested period", async () => {
    const today = new Date();
    prisma.order.findMany = jest.fn().mockResolvedValue([
      { createdAt: today, totalAmount: { toNumber: () => 300 }, paymentStatus: "PAID" },
      { createdAt: today, totalAmount: { toNumber: () => 120 }, paymentStatus: "PENDING" },
    ]);

    const report = await service.getSalesReport(7);

    expect(report.days).toBe(7);
    expect(report.chartData).toHaveLength(7);
    const last = report.chartData[report.chartData.length - 1];
    expect(last).toMatchObject({ sales: 300, orders: 2 });
    expect(report.chartData[0]).toMatchObject({ sales: 0, orders: 0 });
    expect(report.totalRevenue).toBe(300);
    expect(report.orderCount).toBe(2);
  });

  it("clamps invalid periods to a sane range", async () => {
    expect((await service.getSalesReport(0)).days).toBe(30);
    expect((await service.getSalesReport(9999)).days).toBe(365);
  });

  it("calculates sales by category", async () => {
    prisma.orderItem = {
      findMany: jest.fn().mockResolvedValue([
        {
          quantity: 2,
          totalPrice: 200,
          productVariant: {
            product: {
              categoryId: "cat-1",
              category: { id: "cat-1", name: "Lingerie" },
            },
          },
        },
      ]),
    };

    const res = await service.getSalesByCategory(30);
    expect(res).toEqual([
      {
        categoryId: "cat-1",
        categoryName: "Lingerie",
        totalRevenue: 200,
        totalQuantitySold: 2,
      },
    ]);
  });

  it("calculates sales by region", async () => {
    prisma.order = {
      ...prisma.order,
      findMany: jest.fn().mockResolvedValue([
        { shippingCity: "Cairo", totalAmount: 300 },
        { shippingCity: "Cairo", totalAmount: 150 },
        { shippingCity: "Alexandria", totalAmount: 200 },
      ]),
    };

    const res = await service.getSalesByRegion(30);
    expect(res).toEqual([
      { region: "Cairo", totalRevenue: 450, totalOrders: 2 },
      { region: "Alexandria", totalRevenue: 200, totalOrders: 1 },
    ]);
  });
});
