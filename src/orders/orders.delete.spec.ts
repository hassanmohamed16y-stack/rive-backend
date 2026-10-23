import { NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { OrdersService } from "./orders.service";

function setup(order: any) {
  const tx: any = {
    order: { findFirst: jest.fn().mockResolvedValue(order) },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([
        { productVariantId: "v1", quantity: 2 },
        { productVariantId: "v2", quantity: 1 },
      ]),
    },
    productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma: any = {
    $transaction: jest.fn((cb: any) => cb(tx)),
  };
  const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new OrdersService(prisma, auditLogService as any);
  return { service, tx, auditLogService };
}

const baseOrder = {
  id: "o1",
  orderNumber: "RIV-1",
  couponId: "c1",
  totalAmount: "100.00",
};

describe("OrdersService.deleteOrderPermanently", () => {
  it("returns held stock and the coupon use, then hard-deletes a pending order", async () => {
    const { service, tx, auditLogService } = setup({
      ...baseOrder,
      status: OrderStatus.PENDING,
    });

    await expect(
      service.deleteOrderPermanently("o1", "admin-1"),
    ).resolves.toEqual({
      id: "o1",
      deleted: true,
    });

    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stock: { increment: 2 } },
    });
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "v2" },
      data: { stock: { increment: 1 } },
    });
    expect(tx.coupon.updateMany).toHaveBeenCalledTimes(1);
    const [sqlParts, id] = tx.$executeRaw.mock.calls[0];
    expect(sqlParts.join("?")).toBe('DELETE FROM "Order" WHERE "id" = ?');
    expect(id).toBe("o1");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.delete", entityId: "o1" }),
    );
  });

  it("does not touch stock for cancelled or shipped orders", async () => {
    for (const status of [OrderStatus.CANCELLED, OrderStatus.SHIPPED]) {
      const { service, tx } = setup({ ...baseOrder, status });
      await service.deleteOrderPermanently("o1");
      expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
      expect(tx.coupon.updateMany).not.toHaveBeenCalled();
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    }
  });

  it("throws not found for a missing order", async () => {
    const { service, tx } = setup(null);
    await expect(
      service.deleteOrderPermanently("missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
