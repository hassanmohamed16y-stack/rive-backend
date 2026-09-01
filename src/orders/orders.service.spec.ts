import { BadRequestException } from '@nestjs/common';
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
  const order: { id: string; status: OrderStatus } = { id: 'order-1', status: OrderStatus.PENDING };
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
      create: jest.fn(async ({ data }) => ({ ...order, ...data, items: [] })),
      findUnique: jest.fn(async () => order),
      findUniqueOrThrow: jest.fn(async () => order),
      updateMany: jest.fn(async ({ where, data }) => {
        if (order.status !== where.status) return { count: 0 };
        if (where.reservationExpiresAt?.lte && new Date() > where.reservationExpiresAt.lte) return { count: 0 };
        order.status = data.status;
        return { count: 1 };
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([{ productVariantId: 'variant-1', quantity: 1 }]),
    },
  };
  return { prisma: { $transaction: (callback: any) => callback(tx), order: tx.order }, tx, variant, order };
}

describe('OrdersService inventory reservations', () => {
  it('allows exactly one of two simultaneous reservations when stock is one', async () => {
    const context = transactionPrisma(1);
    const service = new OrdersService(context.prisma as any);

    const results = await Promise.allSettled([service.create(dto), service.create(dto)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(context.variant.stock).toBe(0);
  });

  it('rolls back a reservation when stock is insufficient', async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(context.prisma as any);

    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(context.tx.order.create).not.toHaveBeenCalled();
    expect(context.variant.stock).toBe(0);
  });

  it('rejects duplicate variants before reserving stock', async () => {
    const context = transactionPrisma();
    const service = new OrdersService(context.prisma as any);

    await expect(service.create({ ...dto, items: [dto.items[0], dto.items[0]] })).rejects.toThrow('Duplicate');
    expect(context.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it('restores an expired reservation exactly once', async () => {
    const context = transactionPrisma(0);
    const service = new OrdersService(context.prisma as any);
    const expirationMoment = new Date(Date.now() + 1_000);

    await expect(service.expireOrder('order-1', expirationMoment)).resolves.toBe(true);
    await expect(service.expireOrder('order-1', expirationMoment)).resolves.toBe(false);
    expect(context.variant.stock).toBe(1);
    expect(context.order.status).toBe(OrderStatus.EXPIRED);
  });

  it('does not expire or restore stock for paid orders', async () => {
    const context = transactionPrisma(0);
    context.order.status = OrderStatus.PAID;
    const service = new OrdersService(context.prisma as any);

    await expect(service.expireOrder('order-1', new Date())).resolves.toBe(false);
    expect(context.variant.stock).toBe(0);
    expect(context.order.status).toBe(OrderStatus.PAID);
  });

  it('rejects invalid order state transitions', async () => {
    const context = transactionPrisma();
    context.order.status = OrderStatus.DELIVERED;
    const service = new OrdersService(context.prisma as any);

    await expect(service.transitionStatus('order-1', OrderStatus.PAID)).rejects.toThrow('Cannot transition');
  });
});
