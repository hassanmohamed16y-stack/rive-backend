import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
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
    const emailService = {
      send: jest.fn().mockResolvedValue(undefined),
      buildEmailVerificationEmail: jest.fn().mockReturnValue({ subject: 's', html: 'h', text: 't' }),
      buildPasswordResetEmail: jest.fn().mockReturnValue({ subject: 's', html: 'h', text: 't' }),
    };
    return { service: new AuthService(prisma as any, jwtService, emailService as any), prisma, emailService };
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

  it('runs bcrypt.compare even for unknown emails to keep login timing constant', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ email: 'unknown@example.com', password: 'whatever' })).rejects.toThrow('Invalid credentials');

    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith('whatever', expect.any(String));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  describe('changePassword', () => {
    it('changes the password and revokes all active refresh tokens after verifying the current password', async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await service.changePassword('user-1', { currentPassword: 'Current123!', newPassword: 'NewStrongPass123!' });

      expect(bcrypt.compare).toHaveBeenCalledWith('Current123!', baseUser.passwordHash);
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hash' },
      }));
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toHaveProperty('message');
    });

    it('rejects an incorrect current password without changing anything', async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'NewStrongPass123!' }))
        .rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('returns a generic message and never reveals whether the email exists', async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'missing@example.com' });

      expect(result).toEqual({ message: 'If this email exists, a reset link was sent.' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('generates a reset token and returns it outside production', async () => {
      process.env.NODE_ENV = 'test';
      const { service, prisma, emailService } = createService();
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await service.forgotPassword({ email: baseUser.email });

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: baseUser.id },
        data: expect.objectContaining({ passwordResetToken: expect.any(String) }),
      }));
      expect(result).toHaveProperty('token');
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends an email and never returns the token in production', async () => {
      process.env.NODE_ENV = 'production';
      const { service, prisma, emailService } = createService();
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await service.forgotPassword({ email: baseUser.email });

      expect(emailService.send).toHaveBeenCalledTimes(1);
      expect(result).not.toHaveProperty('token');
      expect(result).toEqual({ message: 'If this email exists, a reset link was sent.' });
    });
  });

  describe('resetPassword', () => {
    it('resets the password and revokes refresh tokens for a valid token', async () => {
      const { service, prisma } = createService();
      const userWithToken = { ...baseUser, passwordResetToken: 'valid-token', passwordResetExpiresAt: new Date(Date.now() + 60_000) };
      prisma.user.findUnique.mockResolvedValue(userWithToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await service.resetPassword({ token: 'valid-token', newPassword: 'NewStrongPass123!' });

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: userWithToken.id },
        data: expect.objectContaining({ passwordHash: 'new-hash', passwordResetToken: null, passwordResetExpiresAt: null }),
      }));
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: userWithToken.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toHaveProperty('message');
    });

    it('rejects an invalid token', async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword({ token: 'bad-token', newPassword: 'NewStrongPass123!' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired token', async () => {
      const { service, prisma } = createService();
      const userWithExpiredToken = { ...baseUser, passwordResetToken: 'expired-token', passwordResetExpiresAt: new Date(Date.now() - 60_000) };
      prisma.user.findUnique.mockResolvedValue(userWithExpiredToken);

      await expect(service.resetPassword({ token: 'expired-token', newPassword: 'NewStrongPass123!' }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
