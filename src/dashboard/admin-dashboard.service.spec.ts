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
