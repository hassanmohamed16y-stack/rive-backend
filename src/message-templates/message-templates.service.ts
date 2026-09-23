import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MessageTemplateChannel } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateMessageTemplateDto } from "./dto/update-message-template.dto";

export interface RenderedTemplate {
  key: string;
  channel: MessageTemplateChannel;
  subject: string | null;
  bodyAr: string;
  bodyEn: string | null;
  renderedText: string;
}

@Injectable()
export class MessageTemplatesService {
  private readonly logger = new Logger(MessageTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.messageTemplate.findMany({
      orderBy: { key: "asc" },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Message template with ID "${id}" was not found`);
    }
    return template;
  }

  async update(id: string, dto: UpdateMessageTemplateDto, adminUserId: string) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.bodyAr !== undefined ? { bodyAr: dto.bodyAr } : {}),
        ...(dto.bodyEn !== undefined ? { bodyEn: dto.bodyEn } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditLogService.record({
      userId: adminUserId,
      action: "message-template.update",
      entityType: "MessageTemplate",
      entityId: id,
      changes: {
        before: {
          subject: existing.subject,
          bodyAr: existing.bodyAr,
          bodyEn: existing.bodyEn,
          isActive: existing.isActive,
        },
        after: {
          subject: updated.subject,
          bodyAr: updated.bodyAr,
          bodyEn: updated.bodyEn,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  }

  /**
   * Helper function/service to render a template by key with variables replaced.
   * If template is found, replaces `{{placeholder}}` in `bodyAr`, `bodyEn`, `subject`.
   */
  async renderTemplate(
    key: string,
    variables: Record<string, any> = {},
    lang: "ar" | "en" = "ar",
  ): Promise<RenderedTemplate | null> {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { key },
    });

    if (!template || !template.isActive) {
      this.logger.warn(`Template with key "${key}" not found or inactive.`);
      return null;
    }

    const replacePlaceholders = (text: string | null): string | null => {
      if (!text) return null;
      return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
        const val = variables[varName];
        return val !== undefined && val !== null ? String(val) : "";
      });
    };

    const renderedSubject = replacePlaceholders(template.subject);
    const renderedBodyAr = replacePlaceholders(template.bodyAr) ?? "";
    const renderedBodyEn = replacePlaceholders(template.bodyEn);

    const primaryText = lang === "en" && renderedBodyEn ? renderedBodyEn : renderedBodyAr;

    return {
      key: template.key,
      channel: template.channel,
      subject: renderedSubject,
      bodyAr: renderedBodyAr,
      bodyEn: renderedBodyEn,
      renderedText: primaryText,
    };
  }
}
