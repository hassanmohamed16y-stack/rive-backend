import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AgentApiService } from "./agent-api.service";
import { AgentServiceTokenGuard } from "./agent-service-token.guard";

const TOKEN = "t".repeat(40);

const ctx = (authorization?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  }) as any;

describe("AgentServiceTokenGuard", () => {
  const env = { ...process.env };
  afterEach(() => (process.env = { ...env }));

  it("is off when no token is configured", () => {
    delete process.env.AGENT_SERVICE_TOKEN;
    expect(() => new AgentServiceTokenGuard().canActivate(ctx(`Bearer ${TOKEN}`))).toThrow(
      ServiceUnavailableException,
    );
  });

  it("accepts only the exact bearer token", () => {
    process.env.AGENT_SERVICE_TOKEN = TOKEN;
    const guard = new AgentServiceTokenGuard();
    expect(guard.canActivate(ctx(`Bearer ${TOKEN}`))).toBe(true);
    expect(() => guard.canActivate(ctx("Bearer wrong"))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(UnauthorizedException);
  });
});

describe("AgentApiService", () => {
  const order = {
    id: "o1",
    orderNumber: "RIV-1",
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    totalAmount: new Decimal("500"),
    subtotal: new Decimal("450"),
    discount: new Decimal("0"),
    shippingFee: new Decimal("50"),
    codFee: new Decimal("0"),
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function setup() {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(order), findMany: jest.fn() },
      internalNote: {
        create: jest.fn().mockResolvedValue({ id: "n1", createdAt: new Date() }),
      },
      agentRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const orders = { transitionStatus: jest.fn().mockResolvedValue(order) };
    const audit = { record: jest.fn() };
    return {
      prisma,
      orders,
      audit,
      service: new AgentApiService(prisma as any, orders as any, audit as any),
    };
  }

  it("refuses money-moving statuses", async () => {
    const { service, orders } = setup();
    await expect(service.updateStatus("o1", "PAID")).rejects.toThrow(ForbiddenException);
    await expect(service.updateStatus("o1", "REFUNDED")).rejects.toThrow(ForbiddenException);
    expect(orders.transitionStatus).not.toHaveBeenCalled();
  });

  it("applies safe statuses through the normal transition rules and audits them", async () => {
    const { service, orders, audit } = setup();
    await service.updateStatus("RIV-1", "CONFIRMED", "customer confirmed on WhatsApp");
    expect(orders.transitionStatus).toHaveBeenCalledWith("o1", "CONFIRMED");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.order.status" }),
    );
  });

  it("requires an Idempotency-Key and replays a stored response", async () => {
    const { service, prisma } = setup();
    const run = jest.fn().mockResolvedValue({ ok: 1 });
    await expect(service.idempotent(undefined, "e", run)).rejects.toThrow(BadRequestException);

    await expect(service.idempotent("key-12345", "e", run)).resolves.toEqual({ ok: 1 });
    expect(prisma.agentRequest.create).toHaveBeenCalled();

    prisma.agentRequest.findUnique.mockResolvedValue({ endpoint: "e", response: { ok: 1 } });
    await expect(service.idempotent("key-12345", "e", run)).resolves.toEqual({ ok: 1 });
    expect(run).toHaveBeenCalledTimes(1);

    prisma.agentRequest.findUnique.mockResolvedValue({ endpoint: "other", response: {} });
    await expect(service.idempotent("key-12345", "e", run)).rejects.toThrow(ConflictException);
  });

  it("adds notes marked as written by the AI", async () => {
    const { service, prisma } = setup();
    await service.addNote("o1", " call after 5pm ");
    expect(prisma.internalNote.create.mock.calls[0][0].data).toMatchObject({
      entityType: "Order",
      entityId: "o1",
      content: "[AI] call after 5pm",
    });
  });
});
