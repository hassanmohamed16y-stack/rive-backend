import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  hashSync: jest.fn(() => 'dummy-hash'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const baseUser = {
    id: 'user-1',
    fullName: 'Aisha Rahman',
    email: 'aisha@example.com',
    passwordHash: 'stored-hash',
    role: 'CUSTOMER',
    emailVerifiedAt: null,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    const emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new AuthService(prisma as any, jwtService, auditLogService as any, emailService as any),
      prisma,
      auditLogService,
      emailService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers only a customer and returns no password hash', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    prisma.user.create.mockResolvedValue(baseUser);
    prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });

    const result = await service.register({ fullName: ' Aisha Rahman ', email: 'AISHA@example.com', password: 'StrongPassword123!' });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: 'CUSTOMER', email: 'aisha@example.com', fullName: 'Aisha Rahman', passwordHash: 'new-hash',
    }) }));
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result).toHaveProperty('refreshToken');
    expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'user-1', role: 'CUSTOMER' });
  });

  it('rejects duplicate registration and invalid credentials without revealing which field failed', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(baseUser);
    await expect(service.register({ fullName: 'Aisha Rahman', email: baseUser.email, password: 'StrongPassword123!' }))
      .rejects.toBeInstanceOf(ConflictException);

    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(baseUser);
    await expect(service.login({ email: 'missing@example.com', password: 'wrong' })).rejects.toThrow('Invalid credentials');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.user.update.mockResolvedValue({ ...baseUser, failedLoginAttempts: 1 });
    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toThrow('Invalid credentials');
  });

  it('logs in valid users without returning password hashes', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(baseUser);
    prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({ email: 'AISHA@example.com', password: 'StrongPassword123!' });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result).toHaveProperty('refreshToken');
    expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'user-1' });
  });

  it('locks an account for 15 minutes after 5 failed login attempts', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4 });
    prisma.user.update.mockResolvedValue({ ...baseUser, failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: expect.any(Date) }),
    }));

    prisma.user.findUnique.mockResolvedValue({ ...baseUser, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotates refresh tokens and revokes the old token after use', async () => {
    const { service, prisma } = createService();
    const existingRefresh = { id: 'refresh-1', tokenHash: 'old-hash', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user: baseUser };
    prisma.refreshToken.findFirst.mockResolvedValue(existingRefresh);
    prisma.refreshToken.update.mockResolvedValue({ ...existingRefresh, revokedAt: new Date() });
    prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-2' });

    const result = await service.refresh('raw-refresh-token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'refresh-1' } }));
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result.refreshToken).toBeDefined();

    prisma.refreshToken.findFirst.mockResolvedValueOnce(null);
    await expect(service.refresh('raw-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects unknown refresh tokens', async () => {
    const { service, prisma } = createService();
    prisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(service.refresh('missing')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired JWTs', () => {
    const expiredToken = jwtService.sign({ sub: 'user-1' }, { expiresIn: '-1s' });
    expect(() => jwtService.verify(expiredToken)).toThrow();
  });

  it('changes the password, revokes refresh tokens, and records an audit log without leaking passwords', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.user.findUnique.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    const result = await service.changePassword('user-1', { currentPassword: 'old', newPassword: 'NewStrongPass123!' });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    }));
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auth.password-change',
      userId: 'user-1',
    }));
    expect(JSON.stringify(result)).not.toContain('new-hash');
  });

  it('rejects change-password when the current password is wrong', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'NewStrongPass123!' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forgot-password always returns the same generic message, even for unknown emails', async () => {
    const { service, prisma, emailService } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const unknownResult = await service.forgotPassword('unknown@example.com');

    prisma.user.findUnique.mockResolvedValueOnce(baseUser);
    prisma.user.update.mockResolvedValue(baseUser);
    const knownResult = await service.forgotPassword(baseUser.email);

    expect(unknownResult.message).toEqual(knownResult.message);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordResetToken: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    }));
    const storedToken = (prisma.user.update as jest.Mock).mock.calls[0][0].data.passwordResetToken;
    const [, sentToken] = (emailService.sendPasswordResetEmail as jest.Mock).mock.calls[0];
    expect(storedToken).toEqual(hashToken(sentToken));
  });

  it('resets the password with a valid token and revokes refresh tokens', async () => {
    const { service, prisma, auditLogService } = createService();
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordResetToken: hashToken('valid-token'), passwordResetExpiresAt: new Date(Date.now() + 60_000) });
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    await service.resetPassword('valid-token', 'NewStrongPass123!');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { passwordResetToken: hashToken('valid-token') } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', revokedAt: null },
    }));
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password-reset' }));
  });

  it('rejects an expired password reset token', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordResetToken: hashToken('valid-token'), passwordResetExpiresAt: new Date(Date.now() - 1000) });

    await expect(service.resetPassword('valid-token', 'NewStrongPass123!')).rejects.toThrow('expired');
  });

  it('rejects an unknown password reset token', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword('missing', 'NewStrongPass123!')).rejects.toThrow('Invalid password reset token');
  });
});
