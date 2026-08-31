import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-04-10',
    });
  }

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

  async handleWebhook(body: any, signature?: string, rawBody?: string) {
    // Verify Stripe webhook signature
    if (!signature || !rawBody) {
      throw new BadRequestException('Webhook signature or raw body missing.');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook verification failed: ${(err as Error).message}`);
    }

    const eventType = event.type;
    const eventData = event.data.object as any;

    if (!eventType || !eventData) {
      throw new BadRequestException('Webhook payload missing required event data.');
    }

    const orderId = eventData.metadata?.orderId ?? eventData.orderId;

    if (eventType === 'payment_intent.succeeded' || eventType === 'checkout.session.completed') {
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
