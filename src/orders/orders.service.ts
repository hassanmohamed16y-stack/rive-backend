import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RIV-${timestamp}-${random}`;
  }

  async create(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must include at least one item');
    }

    const orderItemsData = await Promise.all(
      dto.items.map(async (item) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.productVariantId },
          include: { product: true },
        });

        if (!variant) {
          throw new NotFoundException(`Product variant ${item.productVariantId} was not found`);
        }

        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant ${item.productVariantId}. Available: ${variant.stock}`,
          );
        }

        const unitPrice = Number(variant.price);
        const totalPrice = unitPrice * item.quantity;

        return {
          productVariantId: variant.id,
          quantity: item.quantity,
          unitPrice: unitPrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
          productName: variant.product.name,
        };
      }),
    );

    const totalAmount = orderItemsData.reduce((sum, item) => sum + Number(item.totalPrice), 0);

    const orderNumber = this.generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          status: OrderStatus.PENDING,
          totalAmount: totalAmount.toFixed(2),
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          notes: dto.notes,
          items: {
            create: orderItemsData.map((item) => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
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

      await Promise.all(
        orderItemsData.map((item) =>
          tx.productVariant.update({
            where: { id: item.productVariantId },
            data: {
              stock: { decrement: item.quantity },
            },
          }),
        ),
      );

      return createdOrder;
    });

    return order;
  }

  async findOne(orderNumber: string) {
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

    return order;
  }
}
