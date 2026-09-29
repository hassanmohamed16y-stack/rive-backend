import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { calculateCustomerTier } from "./customers.constants";
import { GetCustomersQueryDto } from "./dto/get-customers-query.dto";

const customerOrderInclude = {
  items: {
    include: {
      productVariant: {
        include: {
          product: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapCustomerMetrics(user: {
    id: string;
    fullName: string;
    email: string;
    createdAt: Date;
    orders?: Array<{
      totalAmount: Prisma.Decimal | number;
      paymentStatus: PaymentStatus;
      status: OrderStatus;
      shippingPhone?: string | null;
    }>;
  }) {
    const orders = user.orders ?? [];
    const ordersCount = orders.length;

    const totalSpentNum = orders.reduce((sum, order) => {
      const isPaid =
        order.paymentStatus === PaymentStatus.PAID ||
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.DELIVERED;
      if (isPaid) {
        return sum + Number(order.totalAmount);
      }
      return sum;
    }, 0);

    const totalSpent = Number(totalSpentNum.toFixed(2));
    const tier = calculateCustomerTier(totalSpent);
    const phone = orders.find((o) => o.shippingPhone)?.shippingPhone ?? null;

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone,
      createdAt: user.createdAt,
      ordersCount,
      totalSpent,
      tier,
    };
  }

  async findAll(query: GetCustomersQueryDto) {
    const { search, tier } = query;
    const { page, limit, skip, take } = resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search.trim(), mode: "insensitive" } },
              { email: { contains: search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    if (tier) {
      const targetTier = tier.trim().toUpperCase();
      const allCustomers = await this.prisma.user.findMany({
        where,
        include: {
          orders: {
            select: {
              totalAmount: true,
              paymentStatus: true,
              status: true,
              shippingPhone: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const metricsList = allCustomers
        .map((user) => this.mapCustomerMetrics(user))
        .filter((c) => c.tier === targetTier);

      const total = metricsList.length;
      const paginatedData = metricsList.slice(skip, skip + take);

      return {
        data: paginatedData,
        meta: buildPaginationMeta(page, limit, total),
      };
    }

    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          orders: {
            select: {
              totalAmount: true,
              paymentStatus: true,
              status: true,
              shippingPhone: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = customers.map((user) => this.mapCustomerMetrics(user));

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.CUSTOMER,
      },
      include: {
        orders: {
          select: {
            totalAmount: true,
            paymentStatus: true,
            status: true,
            shippingPhone: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return this.mapCustomerMetrics(user);
  }

  async findByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        role: UserRole.CUSTOMER,
      },
      include: {
        orders: {
          select: {
            totalAmount: true,
            paymentStatus: true,
            status: true,
            shippingPhone: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Customer with email ${normalizedEmail} not found`,
      );
    }

    return this.mapCustomerMetrics(user);
  }

  async findCustomerOrders(customerId: string, paginationInput: PaginationInput) {
    const customer = await this.prisma.user.findFirst({
      where: {
        id: customerId,
        role: UserRole.CUSTOMER,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const { page, limit, skip, take } = resolvePagination(paginationInput);
    const where: Prisma.OrderWhereInput = { userId: customerId };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: customerOrderInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: buildPaginationMeta(page, limit, total),
    };
  }
}
