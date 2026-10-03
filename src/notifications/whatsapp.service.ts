import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { maskPhoneNumber } from "./whatsapp-conversation.util";

export interface WhatsAppProvider {
  sendMessage(
    to: string,
    body: string,
    messageType?: string,
  ): Promise<{ success: boolean; messageId?: string }>;
}

@Injectable()
export class WhatsAppService implements WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get credentials() {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || process.env.WHATSAPP_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "rive_whatsapp_verify_token";
    const isConfigured = Boolean(accessToken && phoneNumberId);

    return {
      accessToken,
      phoneNumberId,
      verifyToken,
      isConfigured,
    };
  }

  /**
   * Sends a WhatsApp message via Meta Cloud API and logs it in database.
   */
  async sendMessage(
    to: string,
    body: string,
    messageType = "text",
  ): Promise<{ success: boolean; messageId?: string }> {
    const { accessToken, phoneNumberId, isConfigured } = this.credentials;

    const cleanPhone = to.replace(/\+/g, "").trim();
    const maskedPhone = maskPhoneNumber(cleanPhone);

    if (!isConfigured) {
      this.logger.warn("WhatsApp API credentials are not configured.");
      throw new ServiceUnavailableException(
        "WhatsApp API credentials are not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { preview_url: false, body },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errCode: number | undefined;
        try {
          const parsed = JSON.parse(errorText);
          errCode = parsed?.error?.code;
        } catch {
          // non-JSON response
        }

        this.logger.error(
          `WhatsApp Cloud API error (${response.status}) sending to ${maskedPhone}: code ${errCode ?? "N/A"}`,
        );

        await this.prisma.whatsAppMessage.create({
          data: {
            recipient: cleanPhone,
            direction: "OUTBOUND",
            messageType,
            body,
            status: "FAILED",
            rawPayload: { code: errCode ?? null, status: response.status },
          },
        });

        if (errCode === 190) {
          throw new BadGatewayException("WhatsApp token needs renewal");
        }

        if (errCode === 131047) {
          throw new BadRequestException(
            "The 24-hour reply window has expired. WhatsApp only allows free-text replies within 24 hours of the customer's last message.",
          );
        }

        if ([4, 17, 32, 613, 80007, 130429].includes(errCode as number)) {
          throw new HttpException("Rate limit reached", HttpStatus.TOO_MANY_REQUESTS);
        }

        throw new BadGatewayException(`WhatsApp API request failed with status ${response.status}`);
      }

      const data = (await response.json()) as { messages?: Array<{ id: string }> };
      const messageId = data?.messages?.[0]?.id;

      await this.prisma.whatsAppMessage.create({
        data: {
          messageId,
          recipient: cleanPhone,
          direction: "OUTBOUND",
          messageType,
          body,
          status: "SENT",
          rawPayload: data as any,
        },
      });

      this.logger.log(`WhatsApp message sent successfully to ${maskedPhone} (ID: ${messageId ?? "N/A"})`);
      return { success: true, messageId };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to send WhatsApp message to ${maskedPhone}`, error);
      throw new BadGatewayException("Failed to send WhatsApp message due to network or configuration error");
    }
  }

  async sendOrderConfirmation(to: string, orderNumber: string, totalAmount: string) {
    const text = `Thank you for your purchase from RIVÉ! Your order #${orderNumber} for total ${totalAmount} EGP has been received and is being processed.`;
    return this.sendMessage(to, text, "order_confirmation");
  }

  async sendOrderStatusUpdate(to: string, orderNumber: string, status: string) {
    const text = `Order Update: Your RIVÉ order #${orderNumber} is now ${status}.`;
    return this.sendMessage(to, text, "order_update");
  }

  async sendShippingNotification(to: string, orderNumber: string, trackingInfo?: string) {
    const text = `Great news! Your RIVÉ order #${orderNumber} has been shipped. ${trackingInfo ? `Tracking: ${trackingInfo}` : ""}`;
    return this.sendMessage(to, text, "shipping");
  }

  async sendDeliveryNotification(to: string, orderNumber: string) {
    const text = `Your RIVÉ order #${orderNumber} has been delivered. Enjoy your luxury items!`;
    return this.sendMessage(to, text, "delivery");
  }

  async sendCustomerSupportMessage(to: string, message: string) {
    return this.sendMessage(to, message, "support");
  }

  verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string {
    const { verifyToken } = this.credentials;
    if (mode === "subscribe" && token === verifyToken && challenge) {
      this.logger.log("WhatsApp Webhook challenge verified successfully.");
      return challenge;
    }
    throw new BadRequestException("Invalid WhatsApp webhook verify token or mode");
  }

  async handleWebhookPayload(payload: any) {
    this.logger.log("Received WhatsApp Webhook event payload");
    try {
      const entry = payload?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          const from = msg.from;
          const body = msg.text?.body || msg.type || "Media/Other";
          const messageId = msg.id;

          await this.prisma.whatsAppMessage.upsert({
            where: { messageId },
            create: {
              messageId,
              recipient: from,
              direction: "INBOUND",
              messageType: msg.type || "text",
              body,
              status: "RECEIVED",
              rawPayload: msg,
            },
            update: {
              status: "RECEIVED",
              rawPayload: msg,
            },
          });
        }
      }

      const statuses = value?.statuses;
      if (statuses && Array.isArray(statuses)) {
        for (const st of statuses) {
          if (st.id) {
            const isFailed = st.status?.toLowerCase() === "failed" || Boolean(st.errors?.length);
            const firstErr = Array.isArray(st.errors) ? st.errors[0] : null;

            if (isFailed && firstErr) {
              const errorObj = {
                code: firstErr.code ?? null,
                title: firstErr.title ?? firstErr.message ?? "Failed",
              };

              const existingMessages = await this.prisma.whatsAppMessage.findMany({
                where: { messageId: st.id },
              });

              for (const existingMsg of existingMessages) {
                const currentPayload = typeof existingMsg.rawPayload === "object" && existingMsg.rawPayload !== null
                  ? existingMsg.rawPayload
                  : {};
                await this.prisma.whatsAppMessage.update({
                  where: { id: existingMsg.id },
                  data: {
                    status: st.status?.toUpperCase() ?? "FAILED",
                    rawPayload: { ...(currentPayload as object), error: errorObj },
                  },
                });
              }
            } else {
              await this.prisma.whatsAppMessage.updateMany({
                where: { messageId: st.id },
                data: { status: st.status?.toUpperCase() ?? "UPDATED" },
              });
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error("Error processing WhatsApp webhook", error);
      return { success: false };
    }
  }

  async sendTestMessage(recipientPhoneNumber: string, customMessage?: string) {
    const { isConfigured } = this.credentials;
    if (!isConfigured) {
      this.logger.warn("WhatsApp test requested but credentials are not configured.");
      throw new ServiceUnavailableException(
        "WhatsApp API credentials are not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
      );
    }
    const messageText = customMessage || "This is a test message from RIVÉ luxury store backend.";
    return this.sendMessage(recipientPhoneNumber, messageText, "test");
  }
}
