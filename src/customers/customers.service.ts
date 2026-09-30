import * as crypto from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DeletionRequestStatus, OrderStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { calculateCustomerTier } from "./customers.constants";
import { CreateDeletionRequestDto } from "./dto/create-deletion-request.dto";
import { GetCustomersQueryDto } from "./dto/get-customers-query.dto";
import { ListDeletionRequestsQueryDto } from "./dto/list-deletion-requests-query.dto";
import { RejectDeletionRequestDto } from "./dto/reject-deletion-request.dto";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

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

  async getCustomerActivity(customerId: string, paginationInput: PaginationInput) {
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

    const [orders, reviews] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: customerId },
        include: {
          statusHistory: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.review.findMany({
        where: { customerId },
        include: { product: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const timeline: Array<{
      id: string;
      type: string;
      title: string;
      date: Date;
      details?: Record<string, any>;
    }> = [];

    // 1. Account registration
    timeline.push({
      id: `reg-${customer.id}`,
      type: "REGISTRATION",
      title: "Customer Account Registered",
      date: customer.createdAt,
      details: { email: customer.email, name: customer.fullName },
    });

    // 2. Orders & Refunds & Status history
    for (const order of orders) {
      timeline.push({
        id: `ord-${order.id}`,
        type: "ORDER_PLACED",
        title: `Placed Order #${order.orderNumber}`,
        date: order.createdAt,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      });

      if (order.status === "REFUNDED" || order.paymentStatus === "REFUNDED") {
        timeline.push({
          id: `ref-${order.id}`,
          type: "REFUND",
          title: `Refund Processed for Order #${order.orderNumber}`,
          date: order.updatedAt,
          details: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount),
          },
        });
      }

      for (const history of order.statusHistory ?? []) {
        timeline.push({
          id: `osh-${history.id}`,
          type: "STATUS_CHANGE",
          title: `Order #${order.orderNumber} status changed to ${history.status}`,
          date: history.createdAt,
          details: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: history.status,
            notes: history.notes,
          },
        });
      }
    }

    // 3. Reviews
    for (const review of reviews) {
      timeline.push({
        id: `rev-${review.id}`,
        type: "REVIEW",
        title: `Reviewed Product: ${review.product?.name ?? "Product"}`,
        date: review.createdAt,
        details: {
          reviewId: review.id,
          productId: review.productId,
          productName: review.product?.name,
          rating: review.rating,
          comment: review.comment,
        },
      });
    }

    // Sort by date desc
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = timeline.length;
    const paginated = timeline.slice(skip, skip + take);

    return {
      data: paginated,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async createDeletionRequest(userId: string, dto: CreateDeletionRequestDto) {
    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: DeletionRequestStatus.PENDING },
    });

    if (existing) {
      return existing;
    }

    const request = await this.prisma.dataDeletionRequest.create({
      data: {
        userId,
        reason: dto.reason,
        status: DeletionRequestStatus.PENDING,
      },
    });

    await this.auditLogService.record({
      userId,
      action: "customer.data_deletion.request",
      entityType: "DataDeletionRequest",
      entityId: request.id,
      changes: dto,
    });

    return request;
  }

  async findDeletionRequests(query: ListDeletionRequestsQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query);
    const { status } = query;

    const where: Prisma.DataDeletionRequestWhereInput = {
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.dataDeletionRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.dataDeletionRequest.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async approveDeletionRequest(id: string, actorUserId?: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException(`Data deletion request ${id} not found`);
    }

    if (request.status !== DeletionRequestStatus.PENDING) {
      throw new BadRequestException("Data deletion request has already been processed");
    }

    const targetUserId = request.userId;
    const user = request.user;

    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Data deletion can only be processed for customer accounts");
    }

    // Check for active orders
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        userId: targetUserId,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
          ],
        },
      },
    });

    if (activeOrder) {
      throw new BadRequestException(
        "Cannot approve deletion request for customer with active orders (PENDING, CONFIRMED, PROCESSING, SHIPPED)",
      );
    }

    // Run everything in a single database transaction
    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      // 1. Explicitly revoke/delete all refresh tokens for that user
      await tx.refreshToken.deleteMany({
        where: { userId: targetUserId },
      });

      // 2. Anonymize user record with a random, unusable passwordHash
      const randomPasswordHash = crypto.randomBytes(32).toString("hex");
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          fullName: "Anonymized User",
          email: `anonymized_${targetUserId}@deleted.local`,
          passwordHash: randomPasswordHash,
          isActive: false,
          deletedAt: new Date(),
          emailVerifiedAt: null,
          emailVerificationToken: null,
          passwordResetToken: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // 3. Anonymize orders personal details (keep financial/items intact for accounting)
      await tx.order.updateMany({
        where: { userId: targetUserId },
        data: {
          customerName: "Anonymized Customer",
          customerEmail: `anonymized_${targetUserId}@deleted.local`,
          shippingPhone: null,
          shippingAddress: "Anonymized Address",
          shippingZipCode: null,
        },
      });

      // 4. Delete Wishlist items
      await tx.wishlistItem.deleteMany({
        where: { customerId: targetUserId },
      });

      // 5. Delete Cart sessions
      await tx.cartSession.deleteMany({
        where: { customerId: targetUserId },
      });

      // 6. Delete Referral codes (cascades rewards)
      await tx.referralCode.deleteMany({
        where: { customerId: targetUserId },
      });

      // 7. Anonymize Reviews
      await tx.review.updateMany({
        where: { customerId: targetUserId },
        data: {
          authorName: "Anonymized Customer",
          customerId: null,
        },
      });

      // 8. Delete/Anonymize Internal Notes
      await tx.internalNote.deleteMany({
        where: { entityType: "User", entityId: targetUserId },
      });
      await tx.internalNote.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      });

      // 9. Anonymize Meta Conversations
      await tx.metaConversation.updateMany({
        where: { userId: targetUserId },
        data: {
          customerName: "Anonymized Customer",
          customerEmail: `anonymized_${targetUserId}@deleted.local`,
          userId: null,
        },
      });

      // 10. Update DataDeletionRequest status
      return tx.dataDeletionRequest.update({
        where: { id },
        data: {
          status: DeletionRequestStatus.APPROVED,
          processedAt: new Date(),
        },
      });
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "customer.data_deletion.approve",
      entityType: "DataDeletionRequest",
      entityId: id,
      changes: { anonymizedUserId: targetUserId },
    });

    return updatedRequest;
  }

  async rejectDeletionRequest(id: string, dto: RejectDeletionRequestDto, actorUserId?: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Data deletion request ${id} not found`);
    }

    if (request.status !== DeletionRequestStatus.PENDING) {
      throw new BadRequestException("Data deletion request has already been processed");
    }

    const updatedRequest = await this.prisma.dataDeletionRequest.update({
      where: { id },
      data: {
        status: DeletionRequestStatus.REJECTED,
        adminNotes: dto.adminNotes,
        processedAt: new Date(),
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "customer.data_deletion.reject",
      entityType: "DataDeletionRequest",
      entityId: id,
      changes: dto,
    });

    return updatedRequest;
  }
}
