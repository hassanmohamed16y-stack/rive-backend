import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
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
      throw new NotFoundException(`Order with id ${orderId} was not found.`);
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('This order has already been paid and processed.');
    }

    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item.');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';

    // Build line items from order items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.productVariant.product.name,
          description: `${item.productVariant.product.name} - Size: ${item.productVariant.size}`,
        },
        unit_amount: Math.round(new Decimal(item.unitPrice).toNumber() * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    try {
      // Create real Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
        success_url: `${frontendUrl}/checkout/success?orderNumber=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout/cancel?orderNumber=${order.orderNumber}`,
      });

      return {
        sessionId: session.id,
        url: session.url,
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: 'Checkout session created successfully.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create Stripe checkout session: ${(error as Error).message}`,
      );
    }
  }

  async handleWebhook(rawBody: Buffer, signature?: string) {
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
