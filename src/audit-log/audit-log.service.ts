import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildPaginationMeta,
  resolvePagination,
} from "../common/utils/pagination";

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip, take } = resolvePagination({
      page: query?.page ? Number(query.page) : undefined,
      limit: query?.limit ? Number(query.limit) : undefined,
    });

    const where: Prisma.AuditLogWhereInput = {};

    if (query?.userId?.trim()) {
      where.userId = query.userId.trim();
    }

    if (query?.action?.trim()) {
      where.action = { contains: query.action.trim(), mode: "insensitive" };
    }

    if (query?.entityType?.trim()) {
      where.entityType = { equals: query.entityType.trim(), mode: "insensitive" };
    }

    if (query?.entityId?.trim()) {
      where.entityId = query.entityId.trim();
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {
        ...(query?.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query?.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async record(entry: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    changes?: unknown;
  }): Promise<void> {
    try {
      const changes = this.toSerializableJson(entry.changes, entry);
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          ...(changes !== undefined ? { changes } : {}),
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to record audit log for ${entry.entityType}:${entry.entityId} (action=${entry.action}): ${reason}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Guards the `entry.changes as Prisma.InputJsonValue` cast that used to happen unconditionally:
   * confirms the value is actually JSON-serializable (no circular refs, BigInt, etc.) before
   * handing it to Prisma. Non-serializable input is logged and dropped rather than throwing,
   * so a bad `changes` payload never prevents the audit entry itself from being recorded.
   */
  private toSerializableJson(
    changes: unknown,
    entry: { entityType: string; entityId: string; action: string },
  ): Prisma.InputJsonValue | undefined {
    if (changes === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue;
    } catch (error) {
      this.logger.warn(
        `Audit log changes payload for ${entry.entityType}:${entry.entityId} (action=${entry.action}) is not JSON-serializable and will be omitted: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
}
