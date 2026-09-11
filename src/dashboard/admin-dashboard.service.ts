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

  async getSalesReport() {
    const overview = await this.getOverviewStats();
    const orderStatusStats = await this.getOrderStatusStatistics();
    const paymentStatusStats = await this.getPaymentStatusStatistics();
    const topProducts = await this.getTopProducts(10);

    return {
      overview,
      orderStatusStats,
      paymentStatusStats,
      topProducts,
      generatedAt: new Date().toISOString(),
    };
  }
}
