import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      sales30DaysAggregate,
      orderItemsGrouped,
      ordersCount30Days,
      cartSessionsCount30Days,
      paidOrdersCount30Days,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ["productVariantId"],
        where: {
          order: {
            paymentStatus: "PAID",
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.cartSession.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.order.count({
        where: {
          paymentStatus: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          totalAmount: true,
          paymentStatus: true,
        },
      }),
    ]);

    const totalSales30Days = sales30DaysAggregate._sum.totalAmount
      ? sales30DaysAggregate._sum.totalAmount.toNumber()
      : 0;

    const variantIds = orderItemsGrouped.map((item) => item.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: { select: { id: true, name: true, slug: true, price: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const top10Products = orderItemsGrouped.map((item) => {
      const v = variantMap.get(item.productVariantId);
      return {
        variantId: item.productVariantId,
        productId: v?.product?.id ?? null,
        productName: v?.product?.name ?? "Unknown Product",
        sku: v?.sku ?? "N/A",
        quantitySold: item._sum.quantity ?? 0,
        totalRevenue: item._sum.totalPrice ? item._sum.totalPrice.toNumber() : 0,
      };
    });

    const baseSessions = Math.max(cartSessionsCount30Days, ordersCount30Days, 1);
    const conversionRatePercent = Number(
      ((paidOrdersCount30Days / baseSessions) * 100).toFixed(2),
    );

    const dailySalesMap: Record<string, number> = {};
    for (const order of recentOrders) {
      if (order.paymentStatus === "PAID") {
        const dateKey = order.createdAt.toISOString().split("T")[0];
        dailySalesMap[dateKey] =
          (dailySalesMap[dateKey] || 0) + Number(order.totalAmount);
      }
    }

    const chartData = Object.entries(dailySalesMap).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    return {
      totalSales30Days,
      totalPaidOrders30Days: paidOrdersCount30Days,
      totalOrders30Days: ordersCount30Days,
      totalCartSessions30Days: cartSessionsCount30Days,
      conversionRatePercent,
      top10Products,
      chartData,
    };
  }
}
