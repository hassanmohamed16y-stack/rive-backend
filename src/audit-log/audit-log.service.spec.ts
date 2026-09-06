import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  function createService() {
    const prisma = { auditLog: { create: jest.fn() } };
    const service = new AuditLogService(prisma as any);
    return { service, prisma };
  }

  it('records an audit log entry with serializable changes', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await service.record({
      userId: 'user-1',
      action: 'auth.refresh-token-reuse-detected',
      entityType: 'User',
      entityId: 'user-1',
      changes: { reason: 'A revoked refresh token was reused; all sessions were revoked.' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'auth.refresh-token-reuse-detected',
        entityType: 'User',
        entityId: 'user-1',
        changes: { reason: 'A revoked refresh token was reused; all sessions were revoked.' },
      },
    });
  });

  it('records an entry without a changes field when none is provided', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

    await service.record({
      action: 'auth.password-change',
      entityType: 'User',
      entityId: 'user-1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: undefined,
        action: 'auth.password-change',
        entityType: 'User',
        entityId: 'user-1',
      },
    });
  });

  it('omits non-JSON-serializable changes (e.g. containing a BigInt) instead of throwing', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.create.mockResolvedValue({ id: 'log-3' });

    await service.record({
      action: 'order.status-transition',
      entityType: 'Order',
      entityId: 'order-1',
      changes: { amount: BigInt(10) },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: undefined,
        action: 'order.status-transition',
        entityType: 'Order',
        entityId: 'order-1',
      },
    });
  });

  it('swallows and logs errors from the database instead of throwing, so callers never fail because auditing failed', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.create.mockRejectedValue(new Error('db unavailable'));

    await expect(service.record({
      action: 'auth.password-change',
      entityType: 'User',
      entityId: 'user-1',
    })).resolves.toBeUndefined();
  });
});
