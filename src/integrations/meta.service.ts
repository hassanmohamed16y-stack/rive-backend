import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private get verifyToken(): string {
    return process.env.META_VERIFY_TOKEN?.trim() || "rive_meta_verify_token";
  }

  verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string {
    if (mode === "subscribe" && token === this.verifyToken && challenge) {
      this.logger.log("Meta Webhook verification challenge succeeded.");
      return challenge;
    }
    throw new BadRequestException("Invalid Meta webhook verify token or mode");
  }

  async handleWebhookPayload(payload: any) {
    this.logger.log("Received Meta Webhook event");
    try {
      const entry = payload?.entry?.[0];
      const messaging = entry?.messaging || entry?.standby;

      if (messaging && Array.isArray(messaging)) {
        for (const item of messaging) {
          if (item.message?.is_echo || item.delivery || item.read) {
            continue;
          }

          const senderId = item.sender?.id;
          const text = item.message?.text || "Non-text media or interaction";
          const platform = entry?.id ? "FACEBOOK" : "INSTAGRAM";

          if (senderId) {
            let conversation = await this.prisma.metaConversation.findUnique({
              where: { platformUserId: senderId },
            });

            if (!conversation) {
              const matchedUser = await this.prisma.user.findFirst({
                where: {
                  OR: [
                    { email: { contains: senderId, mode: "insensitive" } },
                  ],
                },
              });

              conversation = await this.prisma.metaConversation.create({
                data: {
                  platform,
                  platformUserId: senderId,
                  customerName: `Customer ${senderId.slice(-4)}`,
                  userId: matchedUser?.id,
                  status: "OPEN",
                  lastMessageText: text,
                  lastMessageAt: new Date(),
                },
              });
            } else {
              await this.prisma.metaConversation.update({
                where: { id: conversation.id },
                data: {
                  lastMessageText: text,
                  lastMessageAt: new Date(),
                  status: "OPEN",
                },
              });
            }

            await this.prisma.metaMessage.create({
              data: {
                conversationId: conversation.id,
                sender: "CUSTOMER",
                text,
                rawPayload: item,
              },
            });
          }
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error("Error processing Meta webhook", error);
      return { success: false };
    }
  }

  async findAllConversations(
    filters: { platform?: string; status?: string; search?: string },
    pagination: PaginationInput,
  ) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: any = {
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { customerName: { contains: filters.search, mode: "insensitive" } },
              { customerEmail: { contains: filters.search, mode: "insensitive" } },
              { lastMessageText: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.metaConversation.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        skip,
        take,
      }),
      this.prisma.metaConversation.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findConversationMessages(conversationId: string, pagination: PaginationInput) {
    const conversation = await this.prisma.metaConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const { page, limit, skip, take } = resolvePagination(pagination);
    const [messages, total] = await Promise.all([
      this.prisma.metaMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.metaMessage.count({ where: { conversationId } }),
    ]);

    return {
      conversation,
      messages: { data: messages, meta: buildPaginationMeta(page, limit, total) },
    };
  }

  async sendReply(conversationId: string, text: string, userId?: string) {
    const conversation = await this.prisma.metaConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (
      conversation.platform !== "FACEBOOK" &&
      conversation.platform !== "INSTAGRAM"
    ) {
      throw new BadRequestException(
        `Unsupported conversation platform: ${conversation.platform}`,
      );
    }

    const latestCustomerMessage = await this.prisma.metaMessage.findFirst({
      where: {
        conversationId,
        sender: "CUSTOMER",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!latestCustomerMessage) {
      throw new BadRequestException(
        "The 24-hour reply window has expired. You can only reply within 24 hours of the customer's last message.",
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (latestCustomerMessage.createdAt < twentyFourHoursAgo) {
      throw new BadRequestException(
        "The 24-hour reply window has expired. You can only reply within 24 hours of the customer's last message.",
      );
    }

    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    if (!pageAccessToken) {
      throw new ServiceUnavailableException(
        "Meta integration is not configured with a page access token.",
      );
    }

    // Graph API v21.0 send message endpoint.
    // Note: Facebook and Instagram both use graph.facebook.com/v21.0/me/messages with standard messaging payload in current design.
    // Note: Instagram may require a different page token or Instagram-specific endpoint depending on the app setup; verify when the new Meta app is created.
    const url = "https://graph.facebook.com/v21.0/me/messages";

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: conversation.platformUserId },
          messaging_type: "RESPONSE",
          message: { text },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error("Meta Graph API request failed due to network or timeout error");
      throw new BadGatewayException("Failed to communicate with Meta API");
    } finally {
      clearTimeout(timeoutId);
    }

    let responseData: any;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      const errCode = responseData?.error?.code;
      const errSubcode = responseData?.error?.error_subcode;

      this.logger.error(
        `Meta Graph API returned error status ${response.status}, code ${errCode}, subcode ${errSubcode}`,
      );

      if (errCode === 190) {
        throw new BadGatewayException(
          "Meta token needs renewal. Please update the META_PAGE_ACCESS_TOKEN.",
        );
      }

      if (
        errCode === 10 ||
        errCode === 551 ||
        errSubcode === 2018278
      ) {
        throw new BadRequestException(
          "Cannot send message due to Meta messaging window or policy policy restrictions.",
        );
      }

      if ([4, 17, 32, 613].includes(errCode)) {
        throw new HttpException(
          "Meta API rate limit exceeded. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadGatewayException("Failed to send message via Meta API");
    }

    const createdMessage = await this.prisma.$transaction(async (tx) => {
      const newMessage = await tx.metaMessage.create({
        data: {
          conversationId: conversation.id,
          sender: "ADMIN",
          text,
          rawPayload: responseData ?? {},
        },
      });

      await tx.metaConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageText: text,
          lastMessageAt: new Date(),
        },
      });

      return newMessage;
    });

    await this.auditLogService.record({
      userId,
      action: "meta.message.send",
      entityType: "MetaConversation",
      entityId: conversation.id,
      changes: { textLength: text.length },
    });

    return createdMessage;
  }
}
