import * as crypto from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditLogService } from '../audit-log/audit-log.service';
import { buildPaginationMeta, PaginationInput, resolvePagination } from '../common/utils/pagination';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

const RESERVATION_DURATION_MS = 30 * 60 * 1000;

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
  PAID: [OrderStatus.SHIPPED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const orderInclude = {
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
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async onModuleInit() {
    // Expire any reservations that lapsed while the process was offline. Ongoing expiry is
    // driven externally by POST /api/v1/internal/expire-reservations (see
    // internal-orders.controller.ts), invoked by an external cron/scheduler, instead of an
    // in-process setInterval — this avoids redundant work and races across multiple instances.
    await this.expirePendingReservations().catch((error: unknown) => {
      this.logger.error('Unable to expire pending order reservations', error instanceof Error ? error.stack : undefined);
    });
  }

  private async findOrderDetailsById(client: PrismaService | Prisma.TransactionClient, orderId: string) {
    return client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `RIV-${timestamp}-${random}`;
  }

  private generateGuestAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private assertTransition(currentStatus: OrderStatus, nextStatus: OrderStatus) {
    if (currentStatus !== nextStatus && !allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new ConflictException(`Cannot transition order from ${currentStatus} to ${nextStatus}`);
    }
  }

  async create(dto: CreateOrderDto, userId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must include at least one item');
    }

    const variantIds = new Set<string>();
    for (const item of dto.items) {
      if (variantIds.has(item.productVariantId)) {
        throw new BadRequestException('Duplicate product variant in order');
      }
      variantIds.add(item.productVariantId);
    }

    const guestAccessToken = userId ? undefined : this.generateGuestAccessToken();
    const reservationExpiresAt = new Date(Date.now() + RESERVATION_DURATION_MS);

    const order = await this.prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: [...variantIds] } },
        include: { product: true },
      });
      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
      const orderItemsData = dto.items.map((item) => {
        const variant = variantsById.get(item.productVariantId);
        if (!variant) {
          throw new NotFoundException(`Product variant ${item.productVariantId} was not found`);
        }
        if (!variant.isAvailable || variant.product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(`Product variant ${item.productVariantId} is unavailable`);
        }
        const unitPrice = new Decimal(variant.price);
        return {
          productVariantId: variant.id,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          totalPrice: unitPrice.times(item.quantity).toString(),
        };
      });

      for (const item of orderItemsData) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.productVariantId, isAvailable: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(`Insufficient stock for variant ${item.productVariantId}`);
        }
      }

      const totalAmount = orderItemsData.reduce(
        (sum, item) => sum.plus(new Decimal(item.totalPrice)),
        new Decimal(0),
      );
      return tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          guestAccessToken,
          status: OrderStatus.PENDING,
          totalAmount: totalAmount.toString(),
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          notes: dto.notes,
          reservationExpiresAt,
          items: { create: orderItemsData },
        },
        include: orderInclude,
      });
    });

    return {
      ...order,
      guestAccessToken,
    };
  }

  async markPaid(orderId: string, updatedById?: string) {
    return this.prisma.$transaction((tx) => this.markPaidInTransaction(tx, orderId, updatedById));
  }

  async markPaidInTransaction(tx: Prisma.TransactionClient, orderId: string, updatedById?: string) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) return this.findOrderDetailsById(tx, orderId);
    this.assertTransition(order.status, OrderStatus.PAID);
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING, reservationExpiresAt: { gt: new Date() } },
      data: {
        status: OrderStatus.PAID,
        reservationExpiresAt: null,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    if (updated.count !== 1) throw new ConflictException('Order reservation has expired');
    return this.findOrderDetailsById(tx, orderId);
  }

  async transitionStatus(orderId: string, nextStatus: OrderStatus, actorUserId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({ where: { id: orderId } });
      if (!before) {
        throw new NotFoundException('Order not found');
      }

      if (before.status === nextStatus) {
        return { before, after: await this.findOrderDetailsById(tx, orderId) };
      }

      this.assertTransition(before.status, nextStatus);

      let after;
      if (nextStatus === OrderStatus.CANCELLED || nextStatus === OrderStatus.EXPIRED) {
        // Cancelling and expiring a PENDING order follow the same reservation-release logic;
        // only the resulting status differs.
        const released = await this.cancelPendingOrderInTransaction(tx, orderId, nextStatus, undefined, actorUserId);
        if (!released) {
          throw new ConflictException('Order is no longer pending');
        }
        after = await this.findOrderDetailsById(tx, orderId);
      } else if (nextStatus === OrderStatus.PAID) {
        after = await this.markPaidInTransaction(tx, orderId, actorUserId);
      } else {
        after = await tx.order.update({
          where: { id: orderId },
          data: {
            status: nextStatus,
            ...(actorUserId ? { updatedById: actorUserId } : {}),
          },
          include: orderInclude,
        });
      }

      return { before, after };
    });

    if (actorUserId && result.before.status !== result.after.status) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: 'order.status-transition',
        entityType: 'Order',
        entityId: result.after.id,
        changes: { from: result.before.status, to: result.after.status },
      });
    }

    return result.after;
  }

  async cancelPendingOrder(orderId: string, status: 'CANCELLED' | 'EXPIRED', updatedById?: string) {
    return this.prisma.$transaction((tx) => this.cancelPendingOrderInTransaction(tx, orderId, status, undefined, updatedById));
  }

  async cancelByOrderNumber(orderNumber: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber } });
      if (!order) {
        throw new NotFoundException(`Order ${orderNumber} was not found`);
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be cancelled');
      }
      const cancelled = await this.cancelPendingOrderInTransaction(tx, order.id, OrderStatus.CANCELLED);
      if (!cancelled) {
        throw new ConflictException('Only pending orders can be cancelled');
      }
      return this.findOrderDetailsById(tx, order.id);
    });
  }

  async expireOrder(orderId: string, now = new Date()) {
    return this.prisma.$transaction((tx) => this.cancelPendingOrderInTransaction(tx, orderId, OrderStatus.EXPIRED, now));
  }

  async expirePendingReservations(now = new Date()) {
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING, reservationExpiresAt: { lte: now } },
      select: { id: true },
    });
    let expiredCount = 0;
    for (const order of orders) if (await this.expireOrder(order.id, now)) expiredCount += 1;
    return expiredCount;
  }

  async findAll(filters: { status?: OrderStatus }, pagination: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where = filters.status ? { status: filters.status } : {};
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findByIdForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found`);
    }

    return order;
  }

  async cancelPendingOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: 'CANCELLED' | 'EXPIRED',
    now?: Date,
    updatedById?: string,
  ) {
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING,
        ...(now ? { reservationExpiresAt: { lte: now } } : {}),
      },
      data: {
        status,
        reservationExpiresAt: null,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    if (updated.count === 0) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    return true;
  }

  async findOne(orderNumber: string, guestAccessToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} was not found`);
    }

    if (order.userId === null && order.guestAccessToken && !timingSafeStringEqual(order.guestAccessToken, guestAccessToken)) {
      throw new NotFoundException(`Order ${orderNumber} was not found`);
    }

    return order;
  }
}
