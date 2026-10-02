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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Data deletion requests can only be created by customers");
    }

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
    const targetUser = request.user;

    if (!targetUser || targetUser.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Only customer data deletion requests can be approved");
    }

    // Refuse if customer has active orders (PENDING, CONFIRMED, PROCESSING, SHIPPED)
    const activeOrdersCount = await this.prisma.order.count({
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

    if (activeOrdersCount > 0) {
      throw new BadRequestException(
        "Cannot approve data deletion request for a customer with active orders (PENDING, CONFIRMED, PROCESSING, SHIPPED)",
      );
    }

    // Run everything inside one database transaction
    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      // 1. Anonymize user record
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          fullName: "Anonymized User",
          email: `anonymized_${targetUserId}@deleted.local`,
          passwordHash: `UNUSABLE_PASSWORD_HASH_${Math.random().toString(36).substring(2)}_${Date.now()}`,
          isActive: false,
          deletedAt: new Date(),
          emailVerifiedAt: null,
          emailVerificationToken: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          emailVerificationExpiresAt: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });

      // 2. Anonymize personal data on orders but keep all financial/order item records
      await tx.order.updateMany({
        where: { userId: targetUserId },
        data: {
          customerName: "Anonymized Customer",
          customerEmail: `anonymized_${targetUserId}@deleted.local`,
          shippingPhone: null,
          shippingAddress: "Anonymized Address",
          shippingCity: null,
          shippingCountry: null,
          shippingZipCode: null,
          carrier: null,
          trackingNumber: null,
          trackingUrl: null,
          notes: null,
        },
      });

      // 3. Delete or revoke all refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: targetUserId },
      });

      // 4. Delete Wishlist items
      await tx.wishlistItem.deleteMany({
        where: { customerId: targetUserId },
      });

      // 5. Delete Cart sessions
      await tx.cartSession.deleteMany({
        where: { customerId: targetUserId },
      });

      // 6. Anonymize Reviews
      await tx.review.updateMany({
        where: { customerId: targetUserId },
        data: {
          customerId: null,
          authorName: "Anonymized User",
        },
      });

      // 7. Delete Referral codes
      await tx.referralCode.deleteMany({
        where: { customerId: targetUserId },
      });

      // 8. Handle Internal Notes
      await tx.internalNote.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      });
      await tx.internalNote.deleteMany({
        where: { entityType: "User", entityId: targetUserId },
      });

      // 9. Anonymize Meta Conversations
      await tx.metaConversation.updateMany({
        where: { userId: targetUserId },
        data: {
          userId: null,
          customerName: "Anonymized Customer",
          customerEmail: null,
        },
      });

      // 10. Update DataDeletionRequest status
      const updated = await tx.dataDeletionRequest.update({
        where: { id },
        data: {
          status: DeletionRequestStatus.APPROVED,
          processedAt: new Date(),
        },
      });

      return updated;
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

  async blockCustomer(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Admins or staff accounts cannot be blocked or deleted");
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isBlocked: true,
        isActive: false,
      },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "customer.block",
      entityType: "User",
      entityId: id,
      changes: { isBlocked: true, isActive: false },
    });

    return this.findOne(id);
  }

  async unblockCustomer(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Admins or staff accounts cannot be blocked or deleted");
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isBlocked: false,
        isActive: true,
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "customer.unblock",
      entityType: "User",
      entityId: id,
      changes: { isBlocked: false, isActive: true },
    });

    return this.findOne(id);
  }

  async deleteCustomer(id: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            totalAmount: true,
            paymentStatus: true,
            status: true,
            shippingPhone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException("Admins or staff accounts cannot be blocked or deleted");
    }

    const metricsBefore = this.mapCustomerMetrics(user);

    await this.prisma.$transaction(async (tx) => {
      // 1. Anonymize user record
      await tx.user.update({
        where: { id },
        data: {
          fullName: "Anonymized User",
          email: `anonymized_${id}@deleted.local`,
          passwordHash: `UNUSABLE_PASSWORD_HASH_${Math.random().toString(36).substring(2)}_${Date.now()}`,
          isActive: false,
          isBlocked: false,
          deletedAt: new Date(),
          emailVerifiedAt: null,
          emailVerificationToken: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          emailVerificationExpiresAt: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });

      // 2. Anonymize personal data on orders but keep all financial/order item records
      await tx.order.updateMany({
        where: { userId: id },
        data: {
          customerName: "Anonymized Customer",
          customerEmail: `anonymized_${id}@deleted.local`,
          shippingPhone: null,
          shippingAddress: "Anonymized Address",
          shippingCity: null,
          shippingCountry: null,
          shippingZipCode: null,
          carrier: null,
          trackingNumber: null,
          trackingUrl: null,
          notes: null,
        },
      });

      // 3. Delete refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: id },
      });

      // 4. Delete Wishlist items
      await tx.wishlistItem.deleteMany({
        where: { customerId: id },
      });

      // 5. Delete Cart sessions
      await tx.cartSession.deleteMany({
        where: { customerId: id },
      });

      // 6. Anonymize Reviews
      await tx.review.updateMany({
        where: { customerId: id },
        data: {
          customerId: null,
          authorName: "Anonymized User",
        },
      });

      // 7. Delete Referral codes
      await tx.referralCode.deleteMany({
        where: { customerId: id },
      });

      // 8. Handle Internal Notes
      await tx.internalNote.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.internalNote.deleteMany({
        where: { entityType: "User", entityId: id },
      });

      // 9. Anonymize Meta Conversations
      await tx.metaConversation.updateMany({
        where: { userId: id },
        data: {
          userId: null,
          customerName: "Anonymized Customer",
          customerEmail: null,
        },
      });
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "customer.delete",
      entityType: "User",
      entityId: id,
      changes: { deletedAt: new Date() },
    });

    return {
      ...metricsBefore,
      name: "Anonymized User",
      email: `anonymized_${id}@deleted.local`,
      phone: null,
    };
  }
}
