import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverviewStats() {
    const [
      ordersCount,
      customersCount,
      productsCount,
      pendingOrdersCount,
      lowStockVariants,
      totalRevenueAggregate,
      totalDiscountsAggregate,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: "CUSTOMER" } }),
      this.prisma.product.count({ where: { status: "ACTIVE" } }),
      this.prisma.order.count({ where: { status: "PENDING" } }),
      this.prisma.productVariant.count({ where: { stock: { lte: 5 } } }),
      this.prisma.order.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        _sum: { discount: true },
      }),
    ]);

    const totalSales = totalRevenueAggregate._sum.totalAmount
      ? totalRevenueAggregate._sum.totalAmount.toNumber()
      : 0;
    const totalDiscounts = totalDiscountsAggregate._sum.discount
      ? totalDiscountsAggregate._sum.discount.toNumber()
      : 0;

    return {
      totalSales,
      ordersCount,
      customersCount,
      productsCount,
      lowStockProductsCount: lowStockVariants,
      pendingOrdersCount,
      revenue: totalSales,
      discounts: totalDiscounts,
    };
  }

  async getRecentOrders(limit = 5) {
    return this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            productVariant: {
              include: { product: true },
            },
          },
        },
      },
    });
  }

  async getRecentCustomers(limit = 5) {
    return this.prisma.user.findMany({
      where: { role: "CUSTOMER" },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });
  }

  async getLowStockProducts(threshold = 5) {
    return this.prisma.productVariant.findMany({
      where: { stock: { lte: threshold } },
      include: { product: true },
      orderBy: { stock: "asc" },
    });
  }

  async getOrderStatusStatistics() {
    const grouped = await this.prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));
  }

  async getPaymentStatusStatistics() {
    const grouped = await this.prisma.order.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      paymentStatus: g.paymentStatus,
      count: g._count._all,
    }));
  }

  async getTopProducts(limit = 5) {
    const orderItems = await this.prisma.orderItem.groupBy({
      by: ["productVariantId"],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    const variantIds = orderItems.map((i) => i.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantsMap = new Map(variants.map((v) => [v.id, v]));

    return orderItems.map((item) => {
      const variant = variantsMap.get(item.productVariantId);
      return {
        variantId: item.productVariantId,
        productName: variant?.product.name ?? "Unknown",
        sku: variant?.sku ?? "N/A",
        totalQuantitySold: item._sum.quantity ?? 0,
        totalRevenue: item._sum.totalPrice ? item._sum.totalPrice.toNumber() : 0,
      };
    });
  }

  async getSalesReport(days = 30) {
    const periodDays = Number.isFinite(days) && days >= 1 ? Math.min(Math.floor(days), 365) : 30;
    const [overview, orderStatusStats, paymentStatusStats, topProducts, chartData] =
      await Promise.all([
        this.getOverviewStats(),
        this.getOrderStatusStatistics(),
        this.getPaymentStatusStatistics(),
        this.getTopProducts(10),
        this.getDailySales(periodDays),
      ]);

    return {
      overview,
      orderStatusStats,
      paymentStatusStats,
      topProducts,
      days: periodDays,
      chartData,
      totalRevenue: chartData.reduce((sum, d) => sum + d.sales, 0),
      orderCount: chartData.reduce((sum, d) => sum + d.orders, 0),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Daily buckets (Africa/Cairo calendar days) for the last `days` days, zero-filled.
   * `sales` = paid orders' total, `orders` = non-cancelled orders created that day.
   */
  async getDailySales(days: number) {
    const dayKey = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);

    const now = new Date();
    const buckets = new Map<string, { date: string; sales: number; orders: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      buckets.set(key, { date: key, sales: 0, orders: 0 });
    }

    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true, paymentStatus: true },
    });

    for (const order of orders) {
      const bucket = buckets.get(dayKey(order.createdAt));
      if (!bucket) continue;
      bucket.orders += 1;
      if (order.paymentStatus === "PAID") {
        const amount = order.totalAmount as unknown;
        bucket.sales +=
          amount && typeof (amount as { toNumber?: unknown }).toNumber === "function"
            ? (amount as { toNumber: () => number }).toNumber()
            : Number(amount ?? 0);
      }
    }

    return [...buckets.values()];
  }

  async getSalesByCategory(days?: number) {
    const whereOrder: any = {
      status: { not: "CANCELLED" },
    };
    if (days && days > 0) {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      whereOrder.createdAt = { gte: startDate };
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: whereOrder,
      },
      select: {
        quantity: true,
        totalPrice: true,
        productVariant: {
          select: {
            product: {
              select: {
                categoryId: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; totalRevenue: number; totalQuantitySold: number }
    >();

    for (const item of orderItems) {
      const category = item.productVariant?.product?.category;
      if (!category) continue;

      const catId = category.id;
      const catName = category.name;
      const revenue = item.totalPrice ? Number(item.totalPrice) : 0;
      const qty = item.quantity ?? 0;

      const existing = categoryMap.get(catId) ?? {
        categoryId: catId,
        categoryName: catName,
        totalRevenue: 0,
        totalQuantitySold: 0,
      };

      existing.totalRevenue += revenue;
      existing.totalQuantitySold += qty;
      categoryMap.set(catId, existing);
    }

    return Array.from(categoryMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );
  }

  async getSalesByRegion(days?: number) {
    const whereOrder: any = {
      status: { not: "CANCELLED" },
    };
    if (days && days > 0) {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      whereOrder.createdAt = { gte: startDate };
    }

    const orders = await this.prisma.order.findMany({
      where: whereOrder,
      select: {
        shippingCity: true,
        shippingAddress: true,
        totalAmount: true,
      },
    });

    const regionMap = new Map<
      string,
      { region: string; totalRevenue: number; totalOrders: number }
    >();

    for (const order of orders) {
      const region = order.shippingCity?.trim() || "Unspecified";
      const revenue = order.totalAmount ? Number(order.totalAmount) : 0;

      const existing = regionMap.get(region) ?? {
        region,
        totalRevenue: 0,
        totalOrders: 0,
      };

      existing.totalRevenue += revenue;
      existing.totalOrders += 1;
      regionMap.set(region, existing);
    }

    return Array.from(regionMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );
  }
}
