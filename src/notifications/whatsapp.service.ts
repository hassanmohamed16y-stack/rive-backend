/**
 * ====================================================================================
 * WHATSAPP CLOUD API INTEGRATION (META)
 * ====================================================================================
 * NOTE: This integration is currently dormant / inactive because real credentials
 * (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID) have not been configured yet.
 * Once real credentials are supplied as environment variables, this service will
 * automatically route notifications to Meta's WhatsApp Cloud API.
 * ====================================================================================
 */

import { BadRequestException, Injectable, Logger } from "@nestjs/common";

export interface WhatsAppMessagePayload {
  to: string;
  message: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private get credentials() {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const isConfigured = Boolean(accessToken && phoneNumberId);

    return {
      accessToken,
      phoneNumberId,
      isConfigured,
    };
  }

  /**
   * Sends a WhatsApp message via Meta Cloud API.
   * If credentials are missing, logs a warning and fails gracefully.
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const { accessToken, phoneNumberId, isConfigured } = this.credentials;

    if (!isConfigured) {
      this.logger.warn(
        `WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are missing. Skipping send to ${to}.`,
      );
      return { success: false };
    }

    const cleanPhone = to.replace(/\+/g, "");
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
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`WhatsApp Cloud API error (${response.status}): ${errorData}`);
        throw new BadRequestException(`WhatsApp API request failed: status ${response.status}`);
      }

      const data = (await response.json()) as { messages?: Array<{ id: string }> };
      const messageId = data?.messages?.[0]?.id;

      this.logger.log(`WhatsApp message sent successfully to ${to} (ID: ${messageId ?? "N/A"})`);
      return { success: true, messageId };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to send WhatsApp message to ${to}`, error);
      throw new BadRequestException("Failed to send WhatsApp message due to network or configuration error");
    }
  }

  /**
   * Test WhatsApp message sending endpoint callback.
   * Throws BadRequestException if credentials are missing to inform the admin UI explicitly.
   */
  async sendTestMessage(recipientPhoneNumber: string, customMessage?: string) {
    const { isConfigured } = this.credentials;

    if (!isConfigured) {
      this.logger.warn("WhatsApp test requested but credentials are not configured.");
      throw new BadRequestException(
        "WhatsApp API credentials are not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
      );
    }

    const messageText = customMessage || "This is a test message from RIVÉ luxury store backend.";
    return this.sendMessage(recipientPhoneNumber, messageText);
  }
}
