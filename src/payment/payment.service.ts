import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import { isOrderOwnedByActor } from '../common/utils/order-ownership';
import { isPrismaErrorCode } from '../common/utils/prisma-error';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {
    // STRIPE_SECRET_KEY presence outside local development/test is enforced at
    // module-load time in environment.validation.ts (the single source of
    // truth for this check), so no duplicate check is needed here.
    const apiKey = process.env.STRIPE_SECRET_KEY;
    this.stripe = new Stripe(apiKey ?? 'sk_test_placeholder', {
      apiVersion: '2024-04-10',
    });
  }

  async createCheckoutSession(orderId: string, actor?: { userId?: string; role?: string; guestAccessToken?: string }) {
    await this.ordersService.expireOrder(orderId);
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
      throw new NotFoundException('Order not found');
    }

    if (actor?.role !== 'ADMIN' && !isOrderOwnedByActor(order, actor)) {
      throw new ForbiddenException('You do not have permission to checkout this order');
    }

    if (order.status !== OrderStatus.PENDING || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) {
      throw new BadRequestException('This order is not awaiting payment');
    }

    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    if (order.paymentSessionId) {
      const reused = await this.tryReuseExistingCheckoutSession(order.id, order.orderNumber, order.paymentSessionId);
      if (reused) {
        return reused;
      }
      throw new BadRequestException('This order already has a checkout session');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.productVariant.product.name,
          description: `${item.productVariant.product.name} - Size: ${item.productVariant.size}`,
        },
        unit_amount: Math.round(new Decimal(item.unitPrice).toNumber() * 100),
      },
      quantity: item.quantity,
    }));

    try {
      const metadata = { orderId: order.id, orderNumber: order.orderNumber };
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${frontendUrl}/checkout/success?orderNumber=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout/cancel?orderNumber=${order.orderNumber}`,
      }, {
        idempotencyKey: `checkout-session:${order.id}`,
      });

      // NOTE: theoretical race — two concurrent requests for the same PENDING order can both
      // reach this point (Stripe session creation happens outside any DB lock on paymentSessionId).
      // The conditional `updateMany` below (status still PENDING AND paymentSessionId still null)
      // ensures only one request "wins" and persists its session; the loser detects this via the
      // re-read below and reuses the winner's session instead of erroring, so the client always
      // gets a usable checkout link. Left as-is: a stronger fix (e.g. a DB-level advisory lock)
      // adds complexity disproportionate to the risk (Stripe's own idempotencyKey already
      // prevents duplicate charges even in the rare case both requests hit Stripe first).
      const updated = await this.prisma.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING, paymentSessionId: null },
        data: { paymentSessionId: session.id },
      });
      if (updated.count !== 1) {
        const persistedOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          select: { paymentSessionId: true },
        });
        if (persistedOrder?.paymentSessionId === session.id) {
          return {
            sessionId: session.id,
            url: session.url,
            orderId: order.id,
            orderNumber: order.orderNumber,
            message: 'Checkout session already exists.',
          };
        }
        throw new BadRequestException('Order is no longer awaiting payment');
      }

      return {
        sessionId: session.id,
        url: session.url,
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: 'Checkout session created successfully.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create Stripe checkout session for order ${order.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to create Stripe checkout session');
    }
  }

  /**
   * If the order already has a Stripe checkout session recorded, checks whether it is still
   * open/usable and returns a "reuse" response for it. Returns `null` if the existing session
   * is no longer usable (caller should then reject with a "duplicate session" error) —
   * extracted from createCheckoutSession purely for readability.
   */
  private async tryReuseExistingCheckoutSession(orderId: string, orderNumber: string, paymentSessionId: string) {
    try {
      const existingSession = await this.stripe.checkout.sessions.retrieve(paymentSessionId);
      if (existingSession.status === 'open' && existingSession.url) {
        return {
          sessionId: existingSession.id,
          url: existingSession.url,
          orderId,
          orderNumber,
          message: 'Checkout session already exists.',
        };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve existing Stripe checkout session ${paymentSessionId} for order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to retrieve the existing checkout session');
    }
  }

  async handleWebhook(rawBody: Buffer, signature?: string) {
    if (!signature || !rawBody) {
      throw new BadRequestException('Webhook signature or raw body missing');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Webhook verification failed');
    }

    const eventType = event.type;

    if (!event.id || !eventType || !event.data.object) {
      throw new BadRequestException('Webhook payload missing required event data');
    }

    const processedEventTypes = new Set([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ]);
    if (!processedEventTypes.has(eventType)) {
      return { received: true, eventType, message: 'Unhandled webhook event type received.' };
    }

    // Safe to cast now: eventType is one of the checkout.session.* events above,
    // so event.data.object is guaranteed by Stripe to be a Checkout Session.
    const eventData = event.data.object as Stripe.Checkout.Session;

    const orderId = eventData.metadata?.orderId;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { stripeEventId: event.id, eventType, orderId },
        });

        if (!orderId) {
          return { received: true, eventType, message: 'Webhook received without matching order metadata.' };
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { paymentSessionId: true },
        });
        if (!order || !timingSafeStringEqual(order.paymentSessionId, eventData.id)) {
          throw new BadRequestException('Webhook checkout session does not match the order');
        }

        return this.applyVerifiedCheckoutEvent(tx, eventType, eventData, orderId);
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        return { received: true, eventId: event.id, message: 'Webhook already processed.' };
      }
      if (!(error instanceof BadRequestException)) {
        this.logger.error(
          `Unexpected error while processing Stripe webhook ${event.id} (order ${orderId ?? 'unknown'})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw error;
    }
  }

  /**
   * Applies the outcome of a Stripe checkout event whose session has already been verified
   * against the order (see handleWebhook). Extracted for readability: "paid" events mark the
   * order PAID, everything else in the processed set (async_payment_failed, expired) releases
   * the pending reservation as CANCELLED.
   */
  private async applyVerifiedCheckoutEvent(
    tx: Prisma.TransactionClient,
    eventType: string,
    eventData: Stripe.Checkout.Session,
    orderId: string,
  ) {
    if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
      if (eventData.payment_status !== 'paid') {
        return { received: true, orderId, message: 'Checkout session is not paid.' };
      }
      const paidOrder = await this.ordersService.markPaidInTransaction(tx, orderId);
      return { received: true, orderId: paidOrder.id, status: paidOrder.status };
    }

    await this.ordersService.cancelPendingOrderInTransaction(tx, orderId, OrderStatus.CANCELLED);
    return { received: true, orderId, status: OrderStatus.CANCELLED };
  }
}
