import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  toAddress,
  toOrderLines,
  toOrderRef,
  toPiasters,
} from "../agent-events/agent-events.mapper";
import {
  AGENT_ALLOWED_STATUSES,
  OWNER_ONLY_STATUSES,
} from "./agent-api.dto";

const orderInclude = {
  items: { include: { productVariant: { include: { product: true } } } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;

@Injectable()
export class AgentApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  toAgentOrder(order: OrderWithItems) {
    return {
      ...toOrderRef(order),
      payment_status: order.paymentStatus,
      lines: toOrderLines(order.items),
      address: toAddress(order),
      customer_name: order.customerName ?? null,
      subtotal_piasters: toPiasters(order.subtotal),
      discount_piasters: toPiasters(order.discount),
      shipping_piasters: toPiasters(order.shippingFee),
      cod_fee_piasters: toPiasters(order.codFee),
      coupon_code: order.couponCode ?? null,
      carrier: order.carrier ?? null,
      tracking_number: order.trackingNumber ?? null,
      customer_note: order.notes ?? null,
      utm: {
        source: order.utmSource ?? null,
        medium: order.utmMedium ?? null,
        campaign: order.utmCampaign ?? null,
        content: order.utmContent ?? null,
      },
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    };
  }

  /** Accepts the internal id or the order number (RIV-...). */
  private async findOrder(idOrNumber: string): Promise<OrderWithItems> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async getOrder(idOrNumber: string) {
    return this.toAgentOrder(await this.findOrder(idOrNumber));
  }

  async listOrders(params: { status?: string; since?: string; limit?: number }) {
    const where: Prisma.OrderWhereInput = {};
    if (params.status) {
      if (!(params.status in OrderStatus)) {
        throw new BadRequestException("Unknown status");
      }
      where.status = params.status as OrderStatus;
    }
    if (params.since) {
      const since = new Date(params.since);
      if (Number.isNaN(since.getTime())) {
        throw new BadRequestException("since must be an ISO date");
      }
      where.updatedAt = { gte: since };
    }
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const orders = await this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    return { data: orders.map((o) => this.toAgentOrder(o)), count: orders.length };
  }

  /** For nightly reconciliation (P1-07 / P1-10). Card payments only. */
  async listPayments(since?: string) {
    const from = since ? new Date(since) : new Date(Date.now() - 24 * 3600_000);
    if (Number.isNaN(from.getTime())) {
      throw new BadRequestException("since must be an ISO date");
    }
    const orders = await this.prisma.order.findMany({
      where: { paymentMethod: PaymentMethod.ONLINE, updatedAt: { gte: from } },
      orderBy: { updatedAt: "asc" },
      take: 500,
    });
    return {
      since: from.toISOString(),
      data: orders.map((o) => ({
        order: toOrderRef(o),
        payment_status: o.paymentStatus,
        provider: "paymob",
        provider_txn_id: o.paymobTransactionId ?? null,
        amount_piasters: toPiasters(o.totalAmount),
        updated_at: o.updatedAt.toISOString(),
      })),
    };
  }

  async updateStatus(idOrNumber: string, to: string, reason?: string) {
    if ((OWNER_ONLY_STATUSES as readonly string[]).includes(to)) {
      throw new ForbiddenException(
        "This status moves money and needs the owner's approval",
      );
    }
    if (!(AGENT_ALLOWED_STATUSES as readonly string[]).includes(to)) {
      throw new BadRequestException("Status not allowed for the agent");
    }
    const order = await this.findOrder(idOrNumber);
    const from = order.status;
    // The same transition rules as the admin panel apply (server validates).
    await this.ordersService.transitionStatus(order.id, to as OrderStatus);
    await this.auditLogService.record({
      action: "agent.order.status",
      entityType: "Order",
      entityId: order.id,
      changes: { from, to, reason: reason ?? null, actor: "ai_agent" },
    });
    return this.getOrder(order.id);
  }

  async addNote(idOrNumber: string, content: string) {
    const order = await this.findOrder(idOrNumber);
    const note = await this.prisma.internalNote.create({
      data: {
        entityType: "Order",
        entityId: order.id,
        content: `[AI] ${content.trim()}`,
      },
    });
    return { note_id: note.id, order_id: order.id, created_at: note.createdAt.toISOString() };
  }

  /**
   * Runs a write once per Idempotency-Key. A retry with the same key gets the
   * stored response instead of doing the change twice.
   */
  async idempotent<T extends object>(
    key: string | undefined,
    endpoint: string,
    run: () => Promise<T>,
  ): Promise<T> {
    if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new BadRequestException(
        "Idempotency-Key header is required (8-200 chars: letters, digits, . _ : -)",
      );
    }
    const existing = await this.prisma.agentRequest.findUnique({ where: { key } });
    if (existing) {
      if (existing.endpoint !== endpoint) {
        throw new ConflictException("Idempotency-Key already used for another request");
      }
      return existing.response as unknown as T;
    }
    const result = await run();
    try {
      await this.prisma.agentRequest.create({
        data: {
          key,
          endpoint,
          statusCode: 200,
          response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!isPrismaErrorCode(error, "P2002")) throw error;
    }
    return result;
  }
}
