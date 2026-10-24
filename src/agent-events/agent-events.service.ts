import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { signAgentEvent } from "./agent-events.signing";

/**
 * Backend → AI agent events (EVENTS_CONTRACT.md).
 *
 * Design (contract §5):
 * - `enqueue()` writes the event to the AgentOutbox table using the caller's
 *   transaction client, so the event exists if and only if the business change
 *   committed. It never calls the network.
 * - `dispatchDue()` (cron / internal endpoint) signs and POSTs pending rows,
 *   with retries on 1m, 5m, 30m, 2h, 6h, 12h, then marks them `failed`.
 * - `kick()` is an optional best-effort immediate send after a commit, capped
 *   at a few seconds and never throwing, so shoppers are never blocked.
 *
 * Kill switch: AGENT_EVENTS_ENABLED !== "true" keeps writing the outbox but
 * never sends anything. Nothing is lost while the agent is offline or moving.
 */

export type AgentEventSource = "backend" | "admin" | "paymob" | "carrier";

export type OutboxClient = Pick<Prisma.TransactionClient, "agentOutbox">;

export const AGENT_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
];

/** A claimed row is leased for this long; if the worker dies it becomes due again. */
const CLAIM_LEASE_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 256 * 1024;

type OutboxRow = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

export type DispatchSummary = {
  enabled: boolean;
  claimed: number;
  delivered: number;
  retried: number;
  failed: number;
};

@Injectable()
export class AgentEventsService {
  private readonly logger = new Logger(AgentEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  isSendingEnabled(): boolean {
    return (
      process.env.AGENT_EVENTS_ENABLED === "true" &&
      Boolean(process.env.AGENT_BASE_URL) &&
      Boolean(process.env.RIVE_AGENT_WEBHOOK_SECRET)
    );
  }

  private endpoint(): string {
    const base = (process.env.AGENT_BASE_URL ?? "").replace(/\/+$/, "");
    return `${base}/webhook/rive-events`;
  }

  buildEnvelope(
    type: string,
    data: Record<string, unknown>,
    source: AgentEventSource = "backend",
  ) {
    return {
      event_id: `evt_${randomUUID()}`,
      type,
      version: 1,
      occurred_at: new Date().toISOString(),
      source,
      test: process.env.AGENT_EVENTS_TEST === "true",
      data,
    };
  }

  /**
   * Adds an event to the outbox. Pass the transaction client of the business
   * change so both commit (or roll back) together.
   */
  async enqueue(
    client: OutboxClient,
    type: string,
    data: Record<string, unknown>,
    source: AgentEventSource = "backend",
  ): Promise<string> {
    const envelope = this.buildEnvelope(type, data, source);
    await client.agentOutbox.create({
      data: {
        id: envelope.event_id,
        type,
        payload: envelope as unknown as Prisma.InputJsonValue,
        status: "pending",
        nextTryAt: new Date(),
      },
    });
    return envelope.event_id;
  }

  /**
   * Enqueue inside a business transaction without ever breaking it.
   * The insert runs inside a SAVEPOINT: if the outbox write fails (for
   * example the migration is not applied yet), only the event is dropped and
   * logged; the order / payment change still commits normally.
   */
  async enqueueInTx(
    tx: Prisma.TransactionClient,
    type: string,
    data: Record<string, unknown>,
    source: AgentEventSource = "backend",
  ): Promise<string | null> {
    const canSavepoint =
      typeof (tx as { $executeRawUnsafe?: unknown }).$executeRawUnsafe ===
      "function";
    try {
      if (canSavepoint) await tx.$executeRawUnsafe("SAVEPOINT agent_outbox");
      const id = await this.enqueue(tx, type, data, source);
      if (canSavepoint)
        await tx.$executeRawUnsafe("RELEASE SAVEPOINT agent_outbox");
      return id;
    } catch (error) {
      if (canSavepoint) {
        await tx
          .$executeRawUnsafe("ROLLBACK TO SAVEPOINT agent_outbox")
          .catch(() => undefined);
      }
      this.logger.error(
        `Failed to record agent event ${type}; business change kept`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /** Same as enqueue but never throws (for code paths outside a transaction). */
  async enqueueSafe(
    type: string,
    data: Record<string, unknown>,
    source: AgentEventSource = "backend",
  ): Promise<string | null> {
    try {
      return await this.enqueue(this.prisma, type, data, source);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue agent event ${type}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Best-effort immediate delivery right after a commit (contract §5.4).
   * Capped in time, never throws, and does nothing when sending is disabled.
   */
  async kick(maxWaitMs = 3_000): Promise<void> {
    if (!this.isSendingEnabled()) return;
    try {
      await Promise.race([
        this.dispatchDue(10),
        new Promise((resolve) => setTimeout(resolve, maxWaitMs).unref?.()),
      ]);
    } catch (error) {
      this.logger.warn(
        `Immediate agent dispatch failed; the worker will retry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Claims due rows (SKIP LOCKED so parallel workers never double-send). */
  private async claimDue(limit: number, now: Date): Promise<OutboxRow[]> {
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    return this.prisma.$queryRaw<OutboxRow[]>`
      UPDATE "AgentOutbox" SET "status" = 'sending', "nextTryAt" = ${leaseUntil}
      WHERE "id" IN (
        SELECT "id" FROM "AgentOutbox"
        WHERE "status" IN ('pending', 'sending') AND "nextTryAt" <= ${now}
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "type", "payload", "attempts"`;
  }

  async dispatchDue(limit = 50, now = new Date()): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      enabled: this.isSendingEnabled(),
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
    };
    if (!summary.enabled) return summary;

    const rows = await this.claimDue(Math.max(1, Math.min(limit, 200)), now);
    summary.claimed = rows.length;

    for (const row of rows) {
      const outcome = await this.deliver(row);
      summary[outcome] += 1;
    }
    return summary;
  }

  private async deliver(
    row: OutboxRow,
  ): Promise<"delivered" | "retried" | "failed"> {
    const attempts = row.attempts + 1;
    const body = JSON.stringify(row.payload);

    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      await this.markFailed(row.id, attempts, "payload larger than 256 KB");
      return "failed";
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signAgentEvent(
      process.env.RIVE_AGENT_WEBHOOK_SECRET as string,
      timestamp,
      body,
    );

    let status = 0;
    let error = "";
    try {
      const response = await fetch(this.endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Rive-Event-Id": row.id,
          "X-Rive-Timestamp": String(timestamp),
          "X-Rive-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      status = response.status;
      if (!response.ok) error = `HTTP ${status}`;
    } catch (err) {
      error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }

    if (status >= 200 && status < 300) {
      await this.prisma.agentOutbox.update({
        where: { id: row.id },
        data: {
          status: "delivered",
          attempts,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      return "delivered";
    }

    // 400 / 401 will not get better by retrying (contract §2).
    if (status === 400 || status === 401) {
      await this.markFailed(row.id, attempts, error);
      this.logger.error(`Agent rejected event ${row.id} (${row.type}): ${error}`);
      return "failed";
    }

    if (attempts > AGENT_RETRY_DELAYS_MS.length) {
      await this.markFailed(row.id, attempts, error);
      this.logger.error(`Giving up on agent event ${row.id} (${row.type}): ${error}`);
      return "failed";
    }

    await this.prisma.agentOutbox.update({
      where: { id: row.id },
      data: {
        status: "pending",
        attempts,
        lastError: error.slice(0, 500),
        nextTryAt: new Date(Date.now() + AGENT_RETRY_DELAYS_MS[attempts - 1]),
      },
    });
    return "retried";
  }

  private async markFailed(id: string, attempts: number, error: string) {
    await this.prisma.agentOutbox.update({
      where: { id },
      data: { status: "failed", attempts, lastError: error.slice(0, 500) },
    });
  }

  /** Removes old delivered rows (7 days) and old failed rows (30 days). */
  async cleanup(now = new Date()): Promise<number> {
    const day = 24 * 60 * 60_000;
    const result = await this.prisma.agentOutbox.deleteMany({
      where: {
        OR: [
          { status: "delivered", createdAt: { lt: new Date(now.getTime() - 7 * day) } },
          { status: "failed", createdAt: { lt: new Date(now.getTime() - 30 * day) } },
        ],
      },
    });
    // Idempotency records of agent → backend calls are only needed for a week.
    const requests = await this.prisma.agentRequest
      .deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * day) } } })
      .catch(() => ({ count: 0 }));
    return result.count + requests.count;
  }

  async stats() {
    const grouped = await this.prisma.agentOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts: Record<string, number> = { pending: 0, sending: 0, delivered: 0, failed: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    return {
      sending_enabled: this.isSendingEnabled(),
      test_mode: process.env.AGENT_EVENTS_TEST === "true",
      counts,
    };
  }

  async list(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.agentOutbox.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          attempts: true,
          nextTryAt: true,
          lastError: true,
          deliveredAt: true,
          createdAt: true,
        },
      }),
      this.prisma.agentOutbox.count({ where }),
    ]);
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Admin "resend": puts a failed event back in the queue (same event_id). */
  async resend(id: string): Promise<boolean> {
    const result = await this.prisma.agentOutbox.updateMany({
      where: { id, status: "failed" },
      data: { status: "pending", attempts: 0, nextTryAt: new Date(), lastError: null },
    });
    return result.count === 1;
  }
}
