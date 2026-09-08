import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let createMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn().mockResolvedValue({ id: "audit-1" });

    const mockPrisma = {
      auditLog: {
        create: createMock,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("records an audit log entry with correct fields when changes are provided", async () => {
    await service.record({
      userId: "user-123",
      action: "product.update",
      entityType: "Product",
      entityId: "prod-456",
      changes: { price: 100 },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        action: "product.update",
        entityType: "Product",
        entityId: "prod-456",
        changes: { price: 100 },
      },
    });
  });

  it("records an audit log entry without changes field when changes are undefined", async () => {
    await service.record({
      userId: "user-123",
      action: "product.delete",
      entityType: "Product",
      entityId: "prod-789",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        action: "product.delete",
        entityType: "Product",
        entityId: "prod-789",
      },
    });
  });

  it("correctly logs refresh-token-reuse-detected event", async () => {
    await service.record({
      userId: "user-stolen",
      action: "auth.refresh-token-reuse-detected",
      entityType: "User",
      entityId: "user-stolen",
      changes: {
        reason:
          "A revoked refresh token was reused; all sessions were revoked.",
      },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-stolen",
        action: "auth.refresh-token-reuse-detected",
        entityType: "User",
        entityId: "user-stolen",
        changes: {
          reason:
            "A revoked refresh token was reused; all sessions were revoked.",
        },
      },
    });
  });

  it("correctly logs password-change and password-reset events", async () => {
    await service.record({
      userId: "user-1",
      action: "auth.password-change",
      entityType: "User",
      entityId: "user-1",
      changes: { reason: "User changed password" },
    });

    await service.record({
      userId: "user-2",
      action: "auth.password-reset",
      entityType: "User",
      entityId: "user-2",
      changes: { reason: "User reset password" },
    });

    expect(createMock).toHaveBeenNthCalledWith(1, {
      data: {
        userId: "user-1",
        action: "auth.password-change",
        entityType: "User",
        entityId: "user-1",
        changes: { reason: "User changed password" },
      },
    });

    expect(createMock).toHaveBeenNthCalledWith(2, {
      data: {
        userId: "user-2",
        action: "auth.password-reset",
        entityType: "User",
        entityId: "user-2",
        changes: { reason: "User reset password" },
      },
    });
  });

  it("handles write errors gracefully without crashing the calling flow", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation();
    createMock.mockRejectedValue(new Error("Database connection failed"));

    await expect(
      service.record({
        userId: "user-123",
        action: "test.action",
        entityType: "Test",
        entityId: "test-1",
      }),
    ).resolves.not.toThrow();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to record audit log for Test:test-1 (action=test.action): Database connection failed",
      ),
      expect.any(String),
    );

    loggerSpy.mockRestore();
  });

  it("handles non-Error throwables during write gracefully", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation();
    createMock.mockRejectedValue("String error");

    await expect(
      service.record({
        userId: "user-123",
        action: "test.action",
        entityType: "Test",
        entityId: "test-1",
      }),
    ).resolves.not.toThrow();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to record audit log for Test:test-1 (action=test.action): String error",
      ),
      undefined,
    );

    loggerSpy.mockRestore();
  });

  it("omits changes and logs warning if changes payload is not JSON-serializable", async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();

    const circularObj: any = {};
    circularObj.self = circularObj;

    await service.record({
      userId: "user-123",
      action: "test.circular",
      entityType: "Test",
      entityId: "test-2",
      changes: circularObj,
    });

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Audit log changes payload for Test:test-2 (action=test.circular) is not JSON-serializable",
      ),
    );

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        action: "test.circular",
        entityType: "Test",
        entityId: "test-2",
      },
    });

    loggerSpy.mockRestore();
  });
});
