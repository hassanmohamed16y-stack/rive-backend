import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly emailService: EmailService,
  ) {}

  async notifyOrderCreated(order: { orderNumber: string; totalAmount: any; customerEmail?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} created`);
    if (order.shippingPhone) {
      await this.whatsAppService.sendOrderConfirmation(
        order.shippingPhone,
        order.orderNumber,
        order.totalAmount.toString(),
      ).catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyPaymentCompleted(order: { orderNumber: string; customerEmail?: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Payment completed for order ${order.orderNumber}`);
    if (order.shippingPhone) {
      await this.whatsAppService.sendOrderStatusUpdate(
        order.shippingPhone,
        order.orderNumber,
        "PAID",
      ).catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyOrderShipped(order: { orderNumber: string; shippingPhone?: string; trackingInfo?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} shipped`);
    if (order.shippingPhone) {
      await this.whatsAppService.sendShippingNotification(
        order.shippingPhone,
        order.orderNumber,
        order.trackingInfo,
      ).catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyOrderDelivered(order: { orderNumber: string; shippingPhone?: string }) {
    this.logger.log(`Notification: Order ${order.orderNumber} delivered`);
    if (order.shippingPhone) {
      await this.whatsAppService.sendDeliveryNotification(
        order.shippingPhone,
        order.orderNumber,
      ).catch((e) => this.logger.warn("WhatsApp notification error", e));
    }
  }

  async notifyLowStock(variantSku: string, stock: number) {
    this.logger.warn(`Notification: Variant ${variantSku} low stock level (${stock})`);
  }
}
