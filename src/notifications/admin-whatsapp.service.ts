import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { buildPaginationMeta } from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { SendWhatsAppReplyDto, WhatsAppPaginationQueryDto } from "./dto/whatsapp-reply.dto";
import {
  decodeConversationKey,
  encodeConversationKey,
  isValidPhone,
  maskPhoneNumber,
} from "./whatsapp-conversation.util";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class AdminWhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async resolveCustomerNames(phones: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (phones.length === 0) return nameMap;

    try {
      const orders = await this.prisma.order.findMany({
        where: {
          shippingPhone: { not: null },
          customerName: { not: null },
        },
        select: {
          shippingPhone: true,
          customerName: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      for (const phone of phones) {
        const cleanTarget = phone.replace(/\D/g, "");
        const matched = orders.find((o) => {
          if (!o.shippingPhone) return false;
          const cleanOrderPhone = o.shippingPhone.replace(/\D/g, "");
          return cleanOrderPhone.endsWith(cleanTarget) || cleanTarget.endsWith(cleanOrderPhone);
        });
        if (matched?.customerName) {
          nameMap.set(phone, matched.customerName);
        }
      }
    } catch {
      // Best-effort match, never fail
    }

    return nameMap;
  }

  async getConversations(query: WhatsAppPaginationQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const allGroups = await this.prisma.whatsAppMessage.groupBy({
      by: ["recipient"],
      _max: { createdAt: true },
    });

    allGroups.sort((a, b) => {
      const timeA = a._max.createdAt ? new Date(a._max.createdAt).getTime() : 0;
      const timeB = b._max.createdAt ? new Date(b._max.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    const total = allGroups.length;
    const pageGroups = allGroups.slice(skip, skip + limit);
    const pageRecipients = pageGroups.map((g) => g.recipient);

    if (pageRecipients.length === 0) {
      return {
        data: [],
        meta: buildPaginationMeta(page, limit, total),
      };
    }

    const messages = await this.prisma.whatsAppMessage.findMany({
      where: { recipient: { in: pageRecipients } },
      orderBy: { createdAt: "desc" },
    });

    const nameMap = await this.resolveCustomerNames(pageRecipients);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const data = pageRecipients.map((recipient) => {
      const recipientMsgs = messages.filter((m) => m.recipient === recipient);
      const lastMsg = recipientMsgs[0];
      const inboundMsgs = recipientMsgs.filter((m) => m.direction === "INBOUND");
      const latestInbound = inboundMsgs[0];
      const windowOpen = Boolean(latestInbound && latestInbound.createdAt >= twentyFourHoursAgo);
      const windowExpiresAt = latestInbound
        ? new Date(latestInbound.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;

      return {
        conversationKey: encodeConversationKey(recipient),
        phone: maskPhoneNumber(recipient),
        lastMessageText: lastMsg?.body ?? "",
        lastMessageAt: lastMsg?.createdAt ?? null,
        lastDirection: lastMsg?.direction ?? "",
        inboundCount: inboundMsgs.length,
        windowOpen,
        windowExpiresAt,
        customerName: nameMap.get(recipient) ?? null,
      };
    });

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getConversationMessages(conversationKey: string, query: WhatsAppPaginationQueryDto) {
    const decodedPhone = decodeConversationKey(conversationKey);
    if (!isValidPhone(decodedPhone)) {
      throw new NotFoundException("Conversation not found");
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await this.prisma.whatsAppMessage.count({
      where: { recipient: decodedPhone },
    });

    if (total === 0) {
      throw new NotFoundException("Conversation not found");
    }

    const [messages, latestInbound, nameMap] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where: { recipient: decodedPhone },
        select: {
          id: true,
          direction: true,
          messageType: true,
          body: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { recipient: decodedPhone, direction: "INBOUND" },
        orderBy: { createdAt: "desc" },
      }),
      this.resolveCustomerNames([decodedPhone]),
    ]);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const windowOpen = Boolean(latestInbound && latestInbound.createdAt >= twentyFourHoursAgo);
    const windowExpiresAt = latestInbound
      ? new Date(latestInbound.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    return {
      conversation: {
        conversationKey,
        phone: maskPhoneNumber(decodedPhone),
        windowOpen,
        windowExpiresAt,
        customerName: nameMap.get(decodedPhone) ?? null,
      },
      messages: {
        data: messages,
        meta: buildPaginationMeta(page, limit, total),
      },
    };
  }

  async replyToConversation(conversationKey: string, dto: SendWhatsAppReplyDto, userId?: string) {
    const decodedPhone = decodeConversationKey(conversationKey);
    if (!isValidPhone(decodedPhone)) {
      throw new NotFoundException("Conversation not found");
    }

    const latestInbound = await this.prisma.whatsAppMessage.findFirst({
      where: { recipient: decodedPhone, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (!latestInbound || latestInbound.createdAt < twentyFourHoursAgo) {
      throw new BadRequestException(
        "The 24-hour reply window has expired. WhatsApp only allows free-text replies within 24 hours of the customer's last message.",
      );
    }

    await this.whatsAppService.sendMessage(decodedPhone, dto.text, "text");

    const createdRecord = await this.prisma.whatsAppMessage.findFirst({
      where: { recipient: decodedPhone, direction: "OUTBOUND" },
      select: {
        id: true,
        direction: true,
        messageType: true,
        body: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const maskedPhone = maskPhoneNumber(decodedPhone);

    await this.auditLogService.record({
      userId,
      action: "whatsapp.message.send",
      entityType: "WhatsAppConversation",
      entityId: maskedPhone,
      changes: { textLength: dto.text.length },
    });

    return createdRecord;
  }
}
