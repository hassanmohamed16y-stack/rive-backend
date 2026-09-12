import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { createHmac } from "crypto";
import { isOrderOwnedByActor } from "../common/utils/order-ownership";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
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

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";
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
}
