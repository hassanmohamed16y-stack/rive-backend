import * as crypto from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
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

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private expirationTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.expirePendingReservations().catch((error: unknown) => {
      this.logger.error('Unable to expire pending order reservations', error instanceof Error ? error.stack : undefined);
    });
    // Multi-instance deployments should replace this with an external cron/queue and distributed lock.
    // The conditional PENDING transition keeps duplicate workers safe, but an external scheduler avoids redundant work.
    this.expirationTimer = setInterval(() => {
      void this.expirePendingReservations().catch((error: unknown) => {
        this.logger.error('Unable to expire pending order reservations', error instanceof Error ? error.stack : undefined);
      });
    }, 60_000);
    this.expirationTimer.unref();
  }

  onModuleDestroy() {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
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
          orderNumber: this.generateOrderNumber(), userId, guestAccessToken,
          status: OrderStatus.PENDING, totalAmount: totalAmount.toString(),
          customerName: dto.customerName, customerEmail: dto.customerEmail, notes: dto.notes,
          reservationExpiresAt, items: { create: orderItemsData },
        },
        include: { items: { include: { productVariant: { include: { product: true } } } } },
      });
    });

    return {
      ...order,
      guestAccessToken,
    };
  }

  async markPaid(orderId: string) {
    return this.prisma.$transaction((tx) => this.markPaidInTransaction(tx, orderId));
  }

  async markPaidInTransaction(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) return order;
    this.assertTransition(order.status, OrderStatus.PAID);
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING, reservationExpiresAt: { gt: new Date() } },
      data: { status: OrderStatus.PAID, reservationExpiresAt: null },
    });
    if (updated.count !== 1) throw new ConflictException('Order reservation has expired');
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  async transitionStatus(orderId: string, nextStatus: OrderStatus) {
    if (nextStatus === OrderStatus.CANCELLED) {
      return this.cancelPendingOrder(orderId, OrderStatus.CANCELLED);
    }
    if (nextStatus === OrderStatus.EXPIRED) {
      return this.expireOrder(orderId);
    }
    if (nextStatus === OrderStatus.PAID) {
      return this.markPaid(orderId);
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === nextStatus) return order;
      this.assertTransition(order.status, nextStatus);
      return tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    });
  }

  async cancelPendingOrder(orderId: string, status: 'CANCELLED' | 'EXPIRED') {
    return this.prisma.$transaction((tx) => this.cancelPendingOrderInTransaction(tx, orderId, status));
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

  async findAll(filters: { status?: OrderStatus }, pagination: { page?: number; limit?: number }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const where = filters.status ? { status: filters.status } : {};
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: { include: { productVariant: { include: { product: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async cancelPendingOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: 'CANCELLED' | 'EXPIRED',
    now?: Date,
  ) {
    const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.PENDING,
          ...(now ? { reservationExpiresAt: { lte: now } } : {}),
        },
        data: { status, reservationExpiresAt: null },
      });
    if (updated.count === 0) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.productVariant.update({
        where: { id: item.productVariantId }, data: { stock: { increment: item.quantity } },
      });
    }
    return true;
  }

  async findOne(orderNumber: string, guestAccessToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} was not found`);
    }

    if (order.userId === null && order.guestAccessToken && guestAccessToken !== order.guestAccessToken) {
      throw new NotFoundException('Order access token is invalid');
    }

    return order;
  }
}
