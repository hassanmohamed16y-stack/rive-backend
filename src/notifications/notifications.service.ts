import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { MessageTemplatesService } from "../message-templates/message-templates.service";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly emailService: EmailService,
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  async notifyOrderCreated(order: { orderNumber: string; totalAmount: any; customerName?: string; customerEmail?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} created`);

    const rendered = await this.messageTemplatesService.renderTemplate("order_confirmed", {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount.toString(),
      customerName: order.customerName ?? "",
    });

    if (order.shippingPhone) {
      const body = rendered?.renderedText ??
        `Thank you for your purchase from RIVÉ! Your order #${order.orderNumber} for total ${order.totalAmount.toString()} EGP has been received and is being processed.`;
      await this.whatsAppService.sendMessage(order.shippingPhone, body, "order_confirmation")
        .catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyPaymentCompleted(order: { orderNumber: string; customerName?: string; customerEmail?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Payment completed for order ${order.orderNumber}`);

    const rendered = await this.messageTemplatesService.renderTemplate("order_confirmed", {
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
    });

    if (order.shippingPhone) {
      const body = rendered?.renderedText ??
        `Order Update: Your RIVÉ order #${order.orderNumber} is now PAID.`;
      await this.whatsAppService.sendMessage(order.shippingPhone, body, "order_update")
        .catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyOrderShipped(order: { orderNumber: string; customerName?: string; shippingPhone?: string; trackingInfo?: string; trackingLink?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} shipped`);

    const trackingLink = order.trackingLink ?? (order.trackingInfo ? `Tracking: ${order.trackingInfo}` : "");
    const rendered = await this.messageTemplatesService.renderTemplate("order_shipped", {
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
      trackingLink,
      trackingInfo: order.trackingInfo ?? "",
    });

    if (order.shippingPhone) {
      const body = rendered?.renderedText ??
        `Great news! Your RIVÉ order #${order.orderNumber} has been shipped. ${trackingLink}`;
      await this.whatsAppService.sendMessage(order.shippingPhone, body, "shipping")
        .catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyOrderDelivered(order: { orderNumber: string; customerName?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} delivered`);

    const rendered = await this.messageTemplatesService.renderTemplate("order_delivered", {
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
    });

    if (order.shippingPhone) {
      const body = rendered?.renderedText ??
        `Your RIVÉ order #${order.orderNumber} has been delivered. Enjoy your luxury items!`;
      await this.whatsAppService.sendMessage(order.shippingPhone, body, "delivery")
        .catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyOrderCancelled(order: { orderNumber: string; customerName?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} cancelled`);

    const rendered = await this.messageTemplatesService.renderTemplate("order_cancelled", {
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
    });

    if (order.shippingPhone) {
      const body = rendered?.renderedText ??
        `Order Update: Your RIVÉ order #${order.orderNumber} has been cancelled.`;
      await this.whatsAppService.sendMessage(order.shippingPhone, body, "order_cancelled")
        .catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyLowStock(variantSku: string, stock: number) {
    this.logger.warn(`Notification: Variant ${variantSku} low stock level (${stock})`);

    const rendered = await this.messageTemplatesService.renderTemplate("low_stock_alert", {
      variantSku,
      stock,
    });

    if (rendered) {
      this.logger.log(`Low stock alert rendered: ${rendered.renderedText}`);
    }
  }
}
