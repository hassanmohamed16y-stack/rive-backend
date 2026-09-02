import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    changes?: unknown;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          ...(entry.changes !== undefined ? { changes: entry.changes as Prisma.InputJsonValue } : {}),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
