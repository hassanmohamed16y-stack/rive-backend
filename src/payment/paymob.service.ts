import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  forwardRef,
} from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { createHmac } from "crypto";
import { AuditLogService } from "../audit-log/audit-log.service";
import { isOrderOwnedByActor } from "../common/utils/order-ownership";
import { getFirstOrigin } from "../common/utils/origin";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";
import { NotificationsService } from "../notifications/notifications.service";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Optional() private readonly auditLogService?: AuditLogService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private getApiKey(): string {
    return process.env.PAYMOB_API_KEY ?? "";
  }

  private getHmacSecret(): string {
    return process.env.PAYMOB_HMAC_SECRET ?? "";
  }

  private getIntegrationId(): number {
    const val = process.env.PAYMOB_INTEGRATION_ID_CARD;
    return val ? parseInt(val, 10) : 5911535;
  }

  private getPublicKey(): string {
    if (process.env.PAYMOB_PUBLIC_KEY) {
      return process.env.PAYMOB_PUBLIC_KEY;
    }
    const apiKey = this.getApiKey();
    try {
      const parts = apiKey.split(".");
      if (parts.length >= 2) {
        const payloadStr = Buffer.from(parts[1], "base64").toString("utf8");
        const payload = JSON.parse(payloadStr);
        if (payload.public_key) {
          return payload.public_key;
        }
      }
    } catch {
      // Ignore JWT parse error and fallback
    }
    return process.env.PAYMOB_PUBLIC_KEY ?? "egy_pk_test_default";
  }

  async createCheckoutSession(
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

    if (order.paymentSessionId || order.paymobIntentionId) {
      const reused = await this.tryReuseExistingCheckoutSession(
        order.id,
        order.orderNumber,
        order.paymentSessionId || order.paymobIntentionId || "",
      );
      if (reused) {
        return reused;
      }
      throw new BadRequestException(
        "This order already has a checkout session",
      );
    }

    const frontendUrl = getFirstOrigin(
      process.env.FRONTEND_URL,
      "http://localhost:3001",
    );
    const amountInPiasters = Math.round(
      new Decimal(order.totalAmount ?? 0).toNumber() * 100,
    );

    const customerName = order.customerName?.trim() || "Customer";
    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "RIVE";

    const lineItems = order.items.map((item) => ({
      name: item.productVariant.product.name,
      amount: Math.round(new Decimal(item.unitPrice).toNumber() * 100),
      description: `${item.productVariant.product.name} - Size: ${item.productVariant.size}`,
      quantity: item.quantity,
    }));

    const payload = {
      amount: amountInPiasters,
      currency: "EGP",
      payment_methods: [this.getIntegrationId()],
      items: lineItems,
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email: order.customerEmail || "customer@example.com",
        phone_number: "+201000000000",
      },
      special_reference: order.id,
      notification_url: `${frontendUrl}/api/v1/payments/paymob-webhook`,
      redirection_url: `${frontendUrl}/checkout/success?orderNumber=${order.orderNumber}`,
    };

    try {
      const response = await fetch("https://accept.paymob.com/v1/intention/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Paymob Intention API returned status ${response.status}: ${errorText}`,
        );
        throw new BadRequestException("Failed to create Paymob intention");
      }

      const resData = (await response.json()) as {
        id?: string;
        client_secret?: string;
      };

      const clientSecret = resData.client_secret;
      const intentionId = resData.id ? String(resData.id) : undefined;

      if (!clientSecret) {
        throw new BadRequestException(
          "Paymob response missing client_secret",
        );
      }

      const publicKey = this.getPublicKey();
      const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;

      const updated = await this.prisma.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING,
          paymentSessionId: null,
        },
        data: {
          paymentSessionId: clientSecret,
          paymobIntentionId: intentionId,
        },
      });

      if (updated.count !== 1) {
        const persistedOrder = await this.prisma.order.findUnique({
          where: { id: order.id },
          select: { paymentSessionId: true },
        });
        if (persistedOrder?.paymentSessionId === clientSecret) {
          return {
            sessionId: clientSecret,
            url: checkoutUrl,
            orderId: order.id,
            orderNumber: order.orderNumber,
            message: "Checkout session already exists.",
          };
        }
        throw new BadRequestException("Order is no longer awaiting payment");
      }

      return {
        sessionId: clientSecret,
        url: checkoutUrl,
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: "Checkout session created successfully.",
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create Paymob intention for order ${order.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException("Failed to create Paymob checkout session");
    }
  }

  private async tryReuseExistingCheckoutSession(
    orderId: string,
    orderNumber: string,
    paymentSessionId: string,
  ) {
    if (!paymentSessionId) return null;
    const publicKey = this.getPublicKey();
    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${paymentSessionId}`;
    return {
      sessionId: paymentSessionId,
      url: checkoutUrl,
      orderId,
      orderNumber,
      message: "Checkout session already exists.",
    };
  }

  public calculateHmac(payload: any): string {
    const obj = payload?.obj || payload;
    const errorOccured =
      String(obj?.error_occured ?? false) === "true" || obj?.error_occured === true
        ? "true"
        : "false";
    const hasParentTransaction =
      String(obj?.has_parent_transaction ?? false) === "true" ||
      obj?.has_parent_transaction === true
        ? "true"
        : "false";
    const is3dSecure =
      String(obj?.is_3d_secure ?? false) === "true" || obj?.is_3d_secure === true
        ? "true"
        : "false";
    const isAuth =
      String(obj?.is_auth ?? false) === "true" || obj?.is_auth === true
        ? "true"
        : "false";
    const isCapture =
      String(obj?.is_capture ?? false) === "true" || obj?.is_capture === true
        ? "true"
        : "false";
    const isRefunded =
      String(obj?.is_refunded ?? false) === "true" || obj?.is_refunded === true
        ? "true"
        : "false";
    const isStandalonePayment =
      String(obj?.is_standalone_payment ?? false) === "true" ||
      obj?.is_standalone_payment === true
        ? "true"
        : "false";
    const isVoided =
      String(obj?.is_voided ?? false) === "true" || obj?.is_voided === true
        ? "true"
        : "false";
    const pending =
      String(obj?.pending ?? false) === "true" || obj?.pending === true
        ? "true"
        : "false";
    const success =
      String(obj?.success ?? false) === "true" || obj?.success === true
        ? "true"
        : "false";

    const orderId =
      typeof obj?.order === "object" && obj?.order !== null
        ? String(obj.order.id ?? "")
        : String(obj?.order ?? "");

    const owner = String(obj?.owner ?? "");

    const concatenated = [
      String(obj?.amount_cents ?? ""),
      String(obj?.created_at ?? ""),
      String(obj?.currency ?? ""),
      errorOccured,
      hasParentTransaction,
      String(obj?.id ?? ""),
      String(obj?.integration_id ?? ""),
      is3dSecure,
      isAuth,
      isCapture,
      isRefunded,
      isStandalonePayment,
      isVoided,
      orderId,
      owner,
      pending,
      String(obj?.source_data?.pan ?? ""),
      String(obj?.source_data?.sub_type ?? ""),
      String(obj?.source_data?.type ?? ""),
      success,
    ].join("");

    return createHmac("sha512", this.getHmacSecret())
      .update(concatenated)
      .digest("hex");
  }

  async handleWebhook(payload: any, signatureOrQueryHmac?: string) {
    if (!payload) {
      throw new BadRequestException("Webhook payload missing");
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      payload.type === "Buffer" &&
      Array.isArray(payload.data)
    ) {
      payload = Buffer.from(payload.data);
    }

    if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString("utf8"));
      } catch {
        throw new BadRequestException("Invalid JSON payload Buffer");
      }
    }

    const hmacSecret = this.getHmacSecret();
    if (!hmacSecret) {
      throw new BadRequestException("Paymob HMAC secret not configured");
    }

    const receivedHmac =
      signatureOrQueryHmac ||
      (typeof payload === "object" && payload !== null
        ? payload.hmac || payload.obj?.hmac
        : "") ||
      "";

    if (!receivedHmac) {
      throw new BadRequestException("HMAC signature missing");
    }

    const calculatedHmac = this.calculateHmac(payload);

    if (!timingSafeStringEqual(calculatedHmac.toLowerCase(), receivedHmac.toLowerCase())) {
      this.logger.warn("Paymob webhook HMAC verification failed");
      throw new BadRequestException("Webhook verification failed");
    }

    const obj = payload.obj || payload;
    const transactionId = String(obj.id ?? "");
    const eventType = payload.type || "TRANSACTION";

    if (!transactionId) {
      throw new BadRequestException("Webhook payload missing transaction ID");
    }

    const orderId =
      obj.special_reference ||
      obj.order?.merchant_order_id ||
      obj.merchant_order_id ||
      null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.processedPaymobEvent.create({
          data: {
            paymobTransactionId: transactionId,
            eventType,
            orderId,
          },
        });

        if (!orderId) {
          return {
            received: true,
            eventType,
            message: "Webhook received without matching order metadata.",
          };
        }

        const isSuccess =
          (obj.success === true || String(obj.success) === "true") &&
          (obj.pending === false || String(obj.pending) === "false");

        if (isSuccess) {
          const paidOrder = await this.ordersService.markPaidInTransaction(
            tx,
            orderId,
          );

          await tx.order.update({
            where: { id: orderId },
            data: { paymobTransactionId: transactionId },
          });

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
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        return {
          received: true,
          eventId: transactionId,
          message: "Webhook already processed.",
        };
      }
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Unexpected error while processing Paymob webhook ${transactionId} (order ${orderId ?? "unknown"})`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          "Failed to process Paymob webhook",
        );
      }
      throw error;
    }
  }

  async refundTransaction(orderId: string, amount?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (
      order.status === OrderStatus.REFUNDED ||
      order.paymentStatus === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException("Order has already been refunded");
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException("Only paid orders can be refunded");
    }

    if (!order.paymobTransactionId) {
      throw new BadRequestException(
        "Order does not have a valid Paymob transaction ID for refund",
      );
    }

    const refundAmountCents = amount
      ? Math.round(amount * 100)
      : Math.round(new Decimal(order.totalAmount).toNumber() * 100);

    try {
      const response = await fetch(
        "https://accept.paymob.com/api/acceptance/void_refund/refund",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.getApiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction_id: order.paymobTransactionId,
            amount_cents: refundAmountCents,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Paymob Refund API failed with status ${response.status}: ${errorText}`,
        );
        throw new BadRequestException("Failed to process refund with Paymob");
      }

      const resData = await response.json();

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      return {
        success: true,
        orderId: order.id,
        refundedAmount: refundAmountCents / 100,
        paymobResponse: resData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to execute Paymob refund for order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException("Failed to execute Paymob refund");
    }
  }

  private async recordAuditWithDeduplication(
    orderId: string,
    action: string,
    changes?: unknown,
  ): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.auditLog.findFirst({
      where: {
        entityType: "Order",
        entityId: orderId,
        action,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (!existing) {
      if (this.auditLogService) {
        await this.auditLogService.record({
          action,
          entityType: "Order",
          entityId: orderId,
          changes,
        });
      } else {
        await this.prisma.auditLog.create({
          data: {
            action,
            entityType: "Order",
            entityId: orderId,
            changes: changes ? (JSON.parse(JSON.stringify(changes)) as any) : undefined,
          },
        });
      }
    }
  }

  async reconcilePayments(daysBack = 2, audit = false) {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim() === "") {
      throw new ServiceUnavailableException("Paymob API key is not configured");
    }

    const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: sinceDate },
      OR: [
        { paymobTransactionId: { not: null } },
        { paymobIntentionId: { not: null } },
      ],
    };

    if (!audit) {
      where.status = {
        in: [OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
      };
      where.paymentStatus = {
        notIn: [PaymentStatus.PAID, PaymentStatus.REFUNDED],
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      take: 200,
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            productVariant: true,
          },
        },
      },
    });

    let checkedCount = 0;
    let repairedCount = 0;
    let manualReviewCount = 0;
    let mismatchesCount = 0;
    let unlinkedIntentions = 0;
    let failedChecks = 0;
    let attemptedPaymobCalls = 0;

    const mismatches: Array<{
      orderId: string;
      orderNumber: string;
      dbStatus: OrderStatus;
      dbPaymentStatus: PaymentStatus;
      paymobStatus: PaymentStatus;
      paymobTransactionId?: string;
      details: string;
    }> = [];

    const txOrders: typeof orders = [];

    for (const order of orders) {
      if (!order.paymobTransactionId && order.paymobIntentionId) {
        unlinkedIntentions++;
        await this.recordAuditWithDeduplication(
          order.id,
          "payment.reconciliation_unlinked_intention",
          {
            paymobIntentionId: order.paymobIntentionId,
            dbStatus: order.status,
            dbPaymentStatus: order.paymentStatus,
          },
        );
      } else if (order.paymobTransactionId) {
        txOrders.push(order);
      }
    }

    // Process orders with paymobTransactionId in batches of 5 (concurrency limit = 5)
    const BATCH_SIZE = 5;
    for (let i = 0; i < txOrders.length; i += BATCH_SIZE) {
      const batch = txOrders.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (order) => {
          const txId = order.paymobTransactionId!;
          attemptedPaymobCalls++;

          let response: Response;
          try {
            response = await fetch(
              `https://accept.paymob.com/api/acceptance/transactions/${txId}`,
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
              },
            );
          } catch (error) {
            failedChecks++;
            this.logger.error(
              `Failed to fetch Paymob transaction ${txId} for order ${order.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return;
          }

          if (!response.ok) {
            failedChecks++;
            this.logger.warn(
              `Paymob transaction ${txId} request returned HTTP ${response.status}`,
            );
            return;
          }

          let txData: {
            success?: boolean;
            pending?: boolean;
            is_voided?: boolean;
            is_refunded?: boolean;
            amount_cents?: number | string;
            currency?: string;
          };

          try {
            txData = (await response.json()) as any;
          } catch {
            failedChecks++;
            this.logger.error(
              `Failed to parse JSON response for Paymob transaction ${txId}`,
            );
            return;
          }

          checkedCount++;

          // 1. Transaction-to-order binding check
          const txRef =
            (txData as any).special_reference ||
            (txData as any).merchant_order_id ||
            (typeof (txData as any).order === "object" && (txData as any).order !== null
              ? String((txData as any).order.merchant_order_id || "")
              : String((txData as any).order || ""));

          if (!txRef || (txRef !== order.id && txRef !== order.orderNumber)) {
            mismatchesCount++;
            manualReviewCount++;
            mismatches.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              dbStatus: order.status,
              dbPaymentStatus: order.paymentStatus,
              paymobStatus: PaymentStatus.PAID,
              paymobTransactionId: txId,
              details: `Order ${order.orderNumber} (id: ${order.id}) has Paymob transaction ${txId} with non-matching reference '${txRef || "null"}'`,
            });
            await this.recordAuditWithDeduplication(
              order.id,
              "payment.reconciliation_needs_manual_review",
              {
                reason: "transaction_order_reference_mismatch",
                expectedOrderId: order.id,
                expectedOrderNumber: order.orderNumber,
                paymobReference: txRef,
                paymobTransactionId: txId,
              },
            );
            return;
          }

          // 2. Strict Amount & Currency Validation
          const isAmountValid =
            txData.amount_cents !== undefined &&
            txData.amount_cents !== null &&
            Number.isFinite(Number(txData.amount_cents)) &&
            Number.isInteger(Number(txData.amount_cents));

          const isCurrencyValid =
            typeof txData.currency === "string" &&
            txData.currency.trim().length > 0;

          if (!isAmountValid || !isCurrencyValid) {
            mismatchesCount++;
            manualReviewCount++;
            const details = `Order ${order.orderNumber} Paymob transaction ${txId} has missing or invalid amount_cents (${txData.amount_cents}) or currency (${txData.currency})`;
            mismatches.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              dbStatus: order.status,
              dbPaymentStatus: order.paymentStatus,
              paymobStatus: PaymentStatus.PENDING,
              paymobTransactionId: txId,
              details,
            });
            await this.recordAuditWithDeduplication(
              order.id,
              "payment.reconciliation_needs_manual_review",
              {
                reason: "missing_or_invalid_paymob_amount_or_currency",
                amount_cents: txData.amount_cents,
                currency: txData.currency,
                paymobTransactionId: txId,
              },
            );
            return;
          }

          const paymobAmountPiasters = Number(txData.amount_cents);
          const orderAmountPiasters = Math.round(
            new Decimal(order.totalAmount).toNumber() * 100,
          );

          const isAmountMatch = paymobAmountPiasters === orderAmountPiasters;
          const isCurrencyMatch = (txData.currency as string).trim().toUpperCase() === "EGP";

          const isSuccess =
            txData.success === true &&
            txData.pending === false &&
            txData.is_voided !== true &&
            txData.is_refunded !== true;

          const isRefunded = txData.is_refunded === true;

          if (isSuccess && isAmountMatch && isCurrencyMatch) {
            if (order.status === OrderStatus.PENDING) {
              let wasRepaired = false;
              try {
                await this.prisma.$transaction(async (tx) => {
                  await tx.processedPaymobEvent.create({
                    data: {
                      paymobTransactionId: txId,
                      eventType: "RECONCILIATION_AUTO_REPAIR",
                      orderId: order.id,
                    },
                  });

                  await this.ordersService.markPaidInTransaction(tx, order.id);

                  await tx.order.update({
                    where: { id: order.id },
                    data: { paymobTransactionId: txId },
                  });

                  wasRepaired = true;
                });
              } catch (error) {
                if (isPrismaErrorCode(error, "P2002")) {
                  // Already processed
                  return;
                } else {
                  this.logger.error(
                    `Failed to auto-repair PENDING order ${order.id}`,
                    error instanceof Error ? error.stack : String(error),
                  );
                  return;
                }
              }

              if (wasRepaired) {
                repairedCount++;

                await this.recordAuditWithDeduplication(
                  order.id,
                  "payment.reconciliation_auto_repair",
                  {
                    paymobTransactionId: txId,
                    previousStatus: OrderStatus.PENDING,
                    amountPiasters: orderAmountPiasters,
                  },
                );

                try {
                  await this.notificationsService?.notifyPaymentCompleted({
                    orderNumber: order.orderNumber,
                    customerName: order.customerName || undefined,
                    customerEmail: order.customerEmail || undefined,
                    shippingPhone: order.shippingPhone || undefined,
                  });
                } catch (e) {
                  this.logger.warn(
                    `Failed to send payment completion notification for order ${order.id}`,
                    e,
                  );
                }
              }
            } else if (
              order.status === OrderStatus.CANCELLED ||
              order.status === OrderStatus.EXPIRED
            ) {
              let wasRepaired = false;
              let couponLimitExceeded = false;

              try {
                await this.prisma.$transaction(async (tx) => {
                  // a. Conditional update on order status
                  const updatedOrder = await tx.order.updateMany({
                    where: {
                      id: order.id,
                      status: { in: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
                      paymentStatus: { not: PaymentStatus.PAID },
                    },
                    data: {
                      status: OrderStatus.PAID,
                      paymentStatus: PaymentStatus.PAID,
                      paymobTransactionId: txId,
                      reservationExpiresAt: null,
                    },
                  });

                  if (updatedOrder.count !== 1) {
                    return;
                  }

                  // b. Re-reserve stock atomically for each item
                  for (const item of order.items) {
                    const variantUpdate = await tx.productVariant.updateMany({
                      where: {
                        id: item.productVariantId,
                        isAvailable: true,
                        stock: { gte: item.quantity },
                      },
                      data: {
                        stock: { decrement: item.quantity },
                      },
                    });

                    if (variantUpdate.count !== 1) {
                      throw new Error(
                        `INSUFFICIENT_STOCK_VARIANT_${item.productVariantId}`,
                      );
                    }
                  }

                  // c. Re-count coupon if order used a coupon
                  if (order.couponId) {
                    const coupon = await tx.coupon.findUnique({
                      where: { id: order.couponId },
                    });

                    if (coupon) {
                      if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
                        const updatedCoupon = await tx.coupon.updateMany({
                          where: {
                            id: coupon.id,
                            usageCount: { lt: coupon.usageLimit },
                          },
                          data: { usageCount: { increment: 1 } },
                        });

                        if (updatedCoupon.count !== 1) {
                          couponLimitExceeded = true;
                        }
                      } else {
                        await tx.coupon.update({
                          where: { id: coupon.id },
                          data: { usageCount: { increment: 1 } },
                        });
                      }
                    }
                  }

                  // d. Create ProcessedPaymobEvent
                  await tx.processedPaymobEvent.create({
                    data: {
                      paymobTransactionId: txId,
                      eventType: "RECONCILIATION_AUTO_REPAIR",
                      orderId: order.id,
                    },
                  });

                  wasRepaired = true;
                });
              } catch (error) {
                if (isPrismaErrorCode(error, "P2002")) {
                  return;
                }

                if (
                  error instanceof Error &&
                  error.message.startsWith("INSUFFICIENT_STOCK_VARIANT_")
                ) {
                  manualReviewCount++;
                  mismatchesCount++;
                  mismatches.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    dbStatus: order.status,
                    dbPaymentStatus: order.paymentStatus,
                    paymobStatus: PaymentStatus.PAID,
                    paymobTransactionId: txId,
                    details: `Order ${order.orderNumber} is ${order.status} in DB and Paymob payment succeeded, but inventory is insufficient to re-reserve stock.`,
                  });

                  await this.recordAuditWithDeduplication(
                    order.id,
                    "payment.reconciliation_needs_manual_review",
                    {
                      reason: "insufficient_stock_to_re_reserve",
                      dbStatus: order.status,
                      dbPaymentStatus: order.paymentStatus,
                      paymobTransactionId: txId,
                    },
                  );
                  return;
                }

                this.logger.error(
                  `Failed to auto-repair ${order.status} order ${order.id}`,
                  error instanceof Error ? error.stack : String(error),
                );
                return;
              }

              if (wasRepaired) {
                repairedCount++;

                await this.recordAuditWithDeduplication(
                  order.id,
                  "payment.reconciliation_auto_repair",
                  {
                    paymobTransactionId: txId,
                    previousStatus: order.status,
                    amountPiasters: orderAmountPiasters,
                  },
                );

                if (couponLimitExceeded) {
                  await this.recordAuditWithDeduplication(
                    order.id,
                    "payment.reconciliation_coupon_over_limit",
                    {
                      couponId: order.couponId,
                      paymobTransactionId: txId,
                    },
                  );
                }

                try {
                  await this.notificationsService?.notifyPaymentCompleted({
                    orderNumber: order.orderNumber,
                    customerName: order.customerName || undefined,
                    customerEmail: order.customerEmail || undefined,
                    shippingPhone: order.shippingPhone || undefined,
                  });
                } catch (e) {
                  this.logger.warn(
                    `Failed to send payment completion notification for order ${order.id}`,
                    e,
                  );
                }
              }
            }
          } else {
            // Mismatch or manual review required
            let expectedPaymentStatus: PaymentStatus = PaymentStatus.PENDING;
            if (isRefunded) {
              expectedPaymentStatus = PaymentStatus.REFUNDED;
            } else if (isSuccess) {
              expectedPaymentStatus = PaymentStatus.PAID;
            } else if (txData.success === false && txData.pending === false) {
              expectedPaymentStatus = PaymentStatus.FAILED;
            }

            const isMismatch =
              order.paymentStatus !== expectedPaymentStatus ||
              (!isAmountMatch && isSuccess) ||
              (!isCurrencyMatch && isSuccess);

            if (isMismatch) {
              mismatchesCount++;
              manualReviewCount++;

              let details = `Order ${order.orderNumber} is ${order.status}/${order.paymentStatus} in DB but Paymob transaction ${txId} indicates ${expectedPaymentStatus}`;
              if (!isAmountMatch && isSuccess) {
                details += ` (Amount mismatch: DB=${orderAmountPiasters} piasters, Paymob=${paymobAmountPiasters} piasters)`;
              }
              if (!isCurrencyMatch && isSuccess) {
                details += ` (Currency mismatch: Paymob=${txData.currency})`;
              }

              mismatches.push({
                orderId: order.id,
                orderNumber: order.orderNumber,
                dbStatus: order.status,
                dbPaymentStatus: order.paymentStatus,
                paymobStatus: expectedPaymentStatus,
                paymobTransactionId: txId,
                details,
              });

              const auditAction =
                !isAmountMatch || !isCurrencyMatch
                  ? "payment.reconciliation_needs_manual_review"
                  : "payment.reconciliation_mismatch";

              await this.recordAuditWithDeduplication(order.id, auditAction, {
                dbStatus: order.status,
                dbPaymentStatus: order.paymentStatus,
                paymobStatus: expectedPaymentStatus,
                paymobTransactionId: txId,
                paymobAmountPiasters,
                orderAmountPiasters,
                currency: txData.currency,
              });
            }
          }
        }),
      );
    }

    if (attemptedPaymobCalls > 0 && failedChecks / attemptedPaymobCalls > 0.5) {
      throw new BadGatewayException(
        `Paymob reconciliation failed: ${failedChecks} out of ${attemptedPaymobCalls} provider calls failed`,
      );
    }

    return {
      checkedCount,
      repairedCount,
      manualReviewCount,
      mismatchesCount,
      unlinkedIntentions,
      failedChecks,
      mismatches,
    };
  }
}
