import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutSession(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} was not found.`);
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('This order has already been paid and processed.');
    }

    const hostedUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const redirectUrl = `${hostedUrl}/checkout/success?orderNumber=${order.orderNumber}`;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      redirectUrl,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      message: 'Checkout session created successfully.',
    };
  }

  async handleWebhook(body: any, signature?: string) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload.');
    }

    const eventType = body.type;
    const eventData = body.data?.object;

    if (!eventType || !eventData) {
      throw new BadRequestException('Webhook payload missing required event data.');
    }

    const orderId = eventData.metadata?.orderId ?? eventData.orderId;

    if (eventType === 'payment.succeeded' || eventType === 'checkout.session.completed') {
      if (!orderId) {
        return {
          received: true,
          message: 'Webhook received without matching order metadata.',
        };
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order with id ${orderId} was not found.`);
      }

      if (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
        return {
          received: true,
          message: 'Order already processed.',
        };
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
        },
      });

      return {
        received: true,
        orderId,
        status: 'PAID',
      };
    }

    return {
      received: true,
      eventType,
      message: 'Unhandled webhook event type received.',
    };
  }
}
