import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const baseUser = {
    id: 'user-1', fullName: 'Aisha Rahman', email: 'aisha@example.com',
    passwordHash: 'stored-hash', role: 'CUSTOMER', createdAt: new Date(), updatedAt: new Date(),
  };

  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    return { service: new AuthService(prisma as any, jwtService), prisma };
  }

  beforeEach(() => jest.clearAllMocks());

  it('registers only a customer and returns no password hash', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    prisma.user.create.mockResolvedValue(baseUser);

    const result = await service.register({ fullName: ' Aisha Rahman ', email: 'AISHA@example.com', password: 'StrongPassword123!' });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: 'CUSTOMER', email: 'aisha@example.com', fullName: 'Aisha Rahman', passwordHash: 'new-hash',
    }) }));
    expect(result.user).not.toHaveProperty('passwordHash');
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
    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toThrow('Invalid credentials');
  });

  it('logs in valid users without returning password hashes', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({ email: 'AISHA@example.com', password: 'StrongPassword123!' });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'user-1' });
  });

  it('rejects expired JWTs', () => {
    const expiredToken = jwtService.sign({ sub: 'user-1' }, { expiresIn: '-1s' });
    expect(() => jwtService.verify(expiredToken)).toThrow();
  });
});
