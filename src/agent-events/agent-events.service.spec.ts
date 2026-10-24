import { AGENT_RETRY_DELAYS_MS, AgentEventsService } from "./agent-events.service";
import { verifyAgentEventSignature } from "./agent-events.signing";

const SECRET = "x".repeat(40);

function makePrisma(rows: any[] = []) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
    agentOutbox: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      groupBy: jest.fn().mockResolvedValue([{ status: "failed", _count: { _all: 3 } }]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    agentRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

describe("AgentEventsService", () => {
  const env = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.AGENT_EVENTS_ENABLED = "true";
    process.env.AGENT_BASE_URL = "https://agent.example.com/";
    process.env.RIVE_AGENT_WEBHOOK_SECRET = SECRET;
    process.env.AGENT_EVENTS_TEST = "true";
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  const row = (attempts = 0) => ({
    id: "evt_1",
    type: "order.created",
    attempts,
    payload: { event_id: "evt_1", type: "order.created", data: {} },
  });

  it("builds the contract envelope and writes it to the outbox", async () => {
    const prisma = makePrisma();
    const service = new AgentEventsService(prisma as any);
    const id = await service.enqueue(prisma as any, "order.created", { a: 1 });
    expect(id).toMatch(/^evt_/);
    const saved = prisma.agentOutbox.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ id, type: "order.created", status: "pending" });
    expect(saved.payload).toMatchObject({
      event_id: id,
      version: 1,
      source: "backend",
      test: true,
      data: { a: 1 },
    });
  });

  it("enqueueInTx uses a savepoint and never throws", async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      agentOutbox: { create: jest.fn().mockRejectedValue(new Error("no table")) },
    };
    const service = new AgentEventsService(makePrisma() as any);
    await expect(service.enqueueInTx(tx as any, "order.created", {})).resolves.toBeNull();
    expect(tx.$executeRawUnsafe.mock.calls.map((c) => c[0])).toEqual([
      "SAVEPOINT agent_outbox",
      "ROLLBACK TO SAVEPOINT agent_outbox",
    ]);
  });

  it("does not send anything while the kill switch is off", async () => {
    process.env.AGENT_EVENTS_ENABLED = "false";
    const prisma = makePrisma([row()]);
    const service = new AgentEventsService(prisma as any);
    const summary = await service.dispatchDue();
    expect(summary).toMatchObject({ enabled: false, claimed: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs, sends to /webhook/rive-events and marks delivered", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const prisma = makePrisma([row()]);
    const service = new AgentEventsService(prisma as any);
    const summary = await service.dispatchDue();
    expect(summary.delivered).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://agent.example.com/webhook/rive-events");
    expect(init.headers["X-Rive-Event-Id"]).toBe("evt_1");
    const ts = Number(init.headers["X-Rive-Timestamp"]);
    expect(
      verifyAgentEventSignature(SECRET, ts, init.body, init.headers["X-Rive-Signature"]),
    ).toBe(true);
    expect(prisma.agentOutbox.update.mock.calls[0][0].data.status).toBe("delivered");
  });

  it("schedules a retry on a server error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const prisma = makePrisma([row(0)]);
    const service = new AgentEventsService(prisma as any);
    const before = Date.now();
    const summary = await service.dispatchDue();
    expect(summary.retried).toBe(1);
    const data = prisma.agentOutbox.update.mock.calls[0][0].data;
    expect(data.status).toBe("pending");
    expect(data.attempts).toBe(1);
    expect(data.nextTryAt.getTime()).toBeGreaterThanOrEqual(before + AGENT_RETRY_DELAYS_MS[0]);
  });

  it("does not retry 400/401 and gives up after the last retry", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    let prisma = makePrisma([row(0)]);
    let summary = await new AgentEventsService(prisma as any).dispatchDue();
    expect(summary.failed).toBe(1);

    fetchMock.mockRejectedValue(new Error("timeout"));
    prisma = makePrisma([row(AGENT_RETRY_DELAYS_MS.length)]);
    summary = await new AgentEventsService(prisma as any).dispatchDue();
    expect(summary.failed).toBe(1);
    expect(prisma.agentOutbox.update.mock.calls[0][0].data.status).toBe("failed");
  });

  it("reports stats and re-queues failed events", async () => {
    const prisma = makePrisma();
    const service = new AgentEventsService(prisma as any);
    await expect(service.stats()).resolves.toMatchObject({
      sending_enabled: true,
      counts: { failed: 3, pending: 0 },
    });
    await expect(service.resend("evt_1")).resolves.toBe(true);
    expect(prisma.agentOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "evt_1", status: "failed" } }),
    );
    await expect(service.cleanup()).resolves.toBe(3);
  });

  it("kick never throws", async () => {
    const prisma = makePrisma();
    prisma.$queryRaw.mockRejectedValue(new Error("db down"));
    const service = new AgentEventsService(prisma as any);
    await expect(service.kick(50)).resolves.toBeUndefined();
  });
});
