import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
