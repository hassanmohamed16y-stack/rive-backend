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
