// legacy — replaced by Paymob integration, kept temporarily for reference

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { isOrderOwnedByActor } from "../common/utils/order-ownership";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymobService } from "./paymob.service";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;
  private paymobService: PaymobService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    paymobService?: PaymobService,
  ) {
    this.paymobService =
      paymobService ?? new PaymobService(prisma, ordersService);
    // legacy — replaced by Paymob integration, kept temporarily for reference
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2024-04-10",
    });
  }

  async createCheckoutSession(
    orderId: string,
    actor?: { userId?: string; role?: string; guestAccessToken?: string },
  ) {
    return this.paymobService.createCheckoutSession(orderId, actor);
  }

  async handleWebhook(rawBodyOrPayload: any, signature?: string) {
    return this.paymobService.handleWebhook(rawBodyOrPayload, signature);
  }

  async refundTransaction(orderId: string, amount?: number) {
    return this.paymobService.refundTransaction(orderId, amount);
  }

  // =========================================================================
  // Legacy Stripe Implementation Below (kept temporarily for reference)
  // =========================================================================

  async legacyStripeCreateCheckoutSession(
    orderId: string,
    actor?: { userId?: string; role?: string; guestAccessToken?: string },
  ) {
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
      throw new NotFoundException("Order not found");
    }

    if (actor?.role !== "ADMIN" && !isOrderOwnedByActor(order, actor)) {
      throw new ForbiddenException(
        "You do not have permission to checkout this order",
      );
    }

    if (
      order.status !== OrderStatus.PENDING ||
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= new Date()
    ) {
      throw new BadRequestException("This order is not awaiting payment");
    }

    if (!order.items || order.items.length === 0) {
      throw new BadRequestException("Order must contain at least one item");
    }

    if (order.paymentSessionId) {
      const reused = await this.tryReuseExistingCheckoutSession(
        order.id,
        order.orderNumber,
        order.paymentSessionId,
      );
      if (reused) {
        return reused;
      }
      throw new BadRequestException(
        "This order already has a checkout session",
      );
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      order.items.map((item) => ({
        price_data: {
          currency: "usd",
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
      const session = await this.stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          mode: "payment",
          line_items,
          metadata,
          payment_intent_data: { metadata },
          success_url: `${frontendUrl}/checkout/success?orderNumber=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/checkout/cancel?orderNumber=${order.orderNumber}`,
        },
        {
          idempotencyKey: `checkout-session:${order.id}`,
        },
      );

      const updated = await this.prisma.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING,
          paymentSessionId: null,
        },
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
            message: "Checkout session already exists.",
          };
        }
        throw new BadRequestException("Order is no longer awaiting payment");
      }

      return {
        sessionId: session.id,
        url: session.url,
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: "Checkout session created successfully.",
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create Stripe checkout session for order ${order.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException("Failed to create Stripe checkout session");
    }
  }

  private async tryReuseExistingCheckoutSession(
    orderId: string,
    orderNumber: string,
    paymentSessionId: string,
  ) {
    try {
      const existingSession =
        await this.stripe.checkout.sessions.retrieve(paymentSessionId);
      if (existingSession.status === "open" && existingSession.url) {
        return {
          sessionId: existingSession.id,
          url: existingSession.url,
          orderId,
          orderNumber,
          message: "Checkout session already exists.",
        };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve existing Stripe checkout session ${paymentSessionId} for order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        "Unable to retrieve the existing checkout session",
      );
    }
  }

  async legacyStripeHandleWebhook(rawBody: Buffer, signature?: string) {
    if (!signature || !rawBody) {
      throw new BadRequestException("Webhook signature or raw body missing");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException("Webhook secret not configured");
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException("Webhook verification failed");
    }

    const eventType = event.type;

    if (!event.id || !eventType || !event.data.object) {
      throw new BadRequestException(
        "Webhook payload missing required event data",
      );
    }

    const processedEventTypes = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ]);
    if (!processedEventTypes.has(eventType)) {
      return {
        received: true,
        eventType,
        message: "Unhandled webhook event type received.",
      };
    }

    const eventData = event.data.object as Stripe.Checkout.Session;
    const orderId = eventData.metadata?.orderId;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { stripeEventId: event.id, eventType, orderId },
        });

        if (!orderId) {
          return {
            received: true,
            eventType,
            message: "Webhook received without matching order metadata.",
          };
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { paymentSessionId: true },
        });
        if (
          !order ||
          !timingSafeStringEqual(order.paymentSessionId, eventData.id)
        ) {
          throw new BadRequestException(
            "Webhook checkout session does not match the order",
          );
        }

        return this.applyVerifiedCheckoutEvent(
          tx,
          eventType,
          eventData,
          orderId,
        );
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        return {
          received: true,
          eventId: event.id,
          message: "Webhook already processed.",
        };
      }
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Unexpected error while processing Stripe webhook ${event.id} (order ${orderId ?? "unknown"})`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          "Failed to process Stripe webhook",
        );
      }
      throw error;
    }
  }

  private async applyVerifiedCheckoutEvent(
    tx: Prisma.TransactionClient,
    eventType: string,
    eventData: Stripe.Checkout.Session,
    orderId: string,
  ) {
    if (
      eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded"
    ) {
      if (eventData.payment_status !== "paid") {
        return {
          received: true,
          orderId,
          message: "Checkout session is not paid.",
        };
      }
      const paidOrder = await this.ordersService.markPaidInTransaction(
        tx,
        orderId,
      );
      return {
        received: true,
        orderId: paidOrder.id,
        status: paidOrder.status,
      };
    }

    await this.ordersService.cancelPendingOrderInTransaction(
      tx,
      orderId,
      OrderStatus.CANCELLED,
    );
    return { received: true, orderId, status: OrderStatus.CANCELLED };
  }
}
