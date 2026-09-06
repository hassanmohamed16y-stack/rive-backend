import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus, ProductStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

const dto = {
  customerName: 'Aisha Rahman',
  customerEmail: 'aisha@example.com',
  items: [{ productVariantId: 'variant-1', quantity: 1 }],
};

function transactionPrisma(stock = 1) {
  const variant = {
    id: 'variant-1', stock, isAvailable: true, price: '25.00',
    product: { status: ProductStatus.ACTIVE },
  };
  const order: any = {
    id: 'order-1',
    orderNumber: 'RIV-1000-ABC',
    userId: null,
    guestAccessToken: 'guest-token',
    status: OrderStatus.PENDING,
    reservationExpiresAt: new Date(Date.now() + 60_000),
    items: [{ productVariantId: 'variant-1', quantity: 1, productVariant: variant }],
  };
  const tx = {
    productVariant: {
      findMany: jest.fn().mockResolvedValue([variant]),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!variant.isAvailable || variant.stock < where.stock.gte) return { count: 0 };
        variant.stock -= data.stock.decrement;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => ({ ...variant, stock: variant.stock += data.stock.increment })),
    },
    order: {
      create: jest.fn(async ({ data }) => ({ ...order, ...data, items: order.items })),
      findUnique: jest.fn(async ({ where }) => {
        if (where.id && where.id !== order.id) return null;
        if (where.orderNumber && where.orderNumber !== order.orderNumber) return null;
        return order;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        if (where.id !== order.id) throw new NotFoundException('Order not found');
        return order;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (order.id !== where.id || order.status !== where.status) return { count: 0 };
        if (where.reservationExpiresAt?.lte && order.reservationExpiresAt > where.reservationExpiresAt.lte) return { count: 0 };
        if (where.reservationExpiresAt?.gt && (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date())) return { count: 0 };
        order.status = data.status;
        order.reservationExpiresAt = data.reservationExpiresAt ?? null;
        if (data.updatedById) order.updatedById = data.updatedById;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => {
        order.status = data.status;
        if (data.updatedById) order.updatedById = data.updatedById;
        return order;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([{ productVariantId: 'variant-1', quantity: 1 }]),
    },
  };
  const prisma = {
    $transaction: (callback: any) => callback(tx),
    order: tx.order,
  };
  const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
  return { prisma, tx, variant, order, auditLogService };
}

describe('OrdersService inventory reservations', () => {
  it('allows exactly one of two simultaneous reservations when stock is one', async () => {
    const context = transactionPrisma(1);
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    const results = await Promise.allSettled([service.create(dto), service.create(dto)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(context.variant.stock).toBe(0);
  });

  it('rolls back a reservation when stock is insufficient', async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(context.tx.order.create).not.toHaveBeenCalled();
    expect(context.variant.stock).toBe(0);
  });

  it('rejects duplicate variants before reserving stock', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.create({ ...dto, items: [dto.items[0], dto.items[0]] })).rejects.toThrow('Duplicate');
    expect(context.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it('restores an expired reservation exactly once', async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);
    const expirationMoment = new Date(Date.now() + 120_000);

    await expect(service.expireOrder('order-1', expirationMoment)).resolves.toBe(true);
    await expect(service.expireOrder('order-1', expirationMoment)).resolves.toBe(false);
    expect(context.variant.stock).toBe(1);
    expect(context.order.status).toBe(OrderStatus.EXPIRED);
  });

  it('does not expire or restore stock for paid orders', async () => {
    const context = transactionPrisma(0);
    context.order.status = OrderStatus.PAID;
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.expireOrder('order-1', new Date())).resolves.toBe(false);
    expect(context.variant.stock).toBe(0);
    expect(context.order.status).toBe(OrderStatus.PAID);
  });

  it('rejects invalid order state transitions', async () => {
    const context = transactionPrisma();
    context.order.status = OrderStatus.DELIVERED;
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.transitionStatus('order-1', OrderStatus.PAID, 'admin-1')).rejects.toThrow('Cannot transition');
  });

  it('cancels a pending order by order number using shared stock restoration logic', async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.cancelByOrderNumber('RIV-1000-ABC')).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    expect(context.variant.stock).toBe(1);
  });

  it('rejects cancellation when the order is no longer pending', async () => {
    const context = transactionPrisma(0);
    context.order.status = OrderStatus.PAID;
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.cancelByOrderNumber('RIV-1000-ABC')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('OrdersService.findOne ownership enforcement', () => {
  it('returns the order for the matching guest access token holder', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-1000-ABC', { guestAccessToken: 'guest-token' }))
      .resolves.toMatchObject({ orderNumber: 'RIV-1000-ABC' });
  });

  it('rejects a mismatched guest access token with the same NotFoundException used for a missing order', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-1000-ABC', { guestAccessToken: 'wrong-token' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an authenticated user requesting another user\'s order with a NotFoundException (not Forbidden)', async () => {
    const context = transactionPrisma();
    context.order.userId = 'owner-1';
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-1000-ABC', { userId: 'other-user', role: 'CUSTOMER' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows the owning authenticated user to fetch their order', async () => {
    const context = transactionPrisma();
    context.order.userId = 'owner-1';
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-1000-ABC', { userId: 'owner-1', role: 'CUSTOMER' }))
      .resolves.toMatchObject({ orderNumber: 'RIV-1000-ABC' });
  });

  it('allows an admin to bypass ownership checks entirely', async () => {
    const context = transactionPrisma();
    context.order.userId = 'owner-1';
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-1000-ABC', { userId: 'admin-1', role: 'ADMIN' }))
      .resolves.toMatchObject({ orderNumber: 'RIV-1000-ABC' });
  });

  it('rejects an order number that does not exist at all with a NotFoundException, even for an admin', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-DOES-NOT-EXIST', { userId: 'admin-1', role: 'ADMIN' }))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('RIV-DOES-NOT-EXIST', { userId: 'admin-1', role: 'ADMIN' }))
      .rejects.toThrow('Order RIV-DOES-NOT-EXIST was not found');
  });

  it('rejects an order number that does not exist at all for an anonymous/guest caller', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any, context.auditLogService as any);

    await expect(service.findOne('RIV-DOES-NOT-EXIST', { guestAccessToken: 'guest-token' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
