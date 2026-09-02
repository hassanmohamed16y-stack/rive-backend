import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type UserRole = 'ADMIN' | 'CUSTOMER';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_LOCKOUT_THRESHOLD = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

type SafeUser = Omit<User, 'passwordHash' | 'emailVerificationToken' | 'emailVerificationExpiresAt' | 'failedLoginAttempts' | 'lockedUntil'>;
type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: User): SafeUser {
    const {
      passwordHash: _passwordHash,
      emailVerificationToken: _emailVerificationToken,
      emailVerificationExpiresAt: _emailVerificationExpiresAt,
      failedLoginAttempts: _failedLoginAttempts,
      lockedUntil: _lockedUntil,
      ...safeUser
    } = user;

    return safeUser;
  }

  private signAccessToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokenPair(user: User, client: PrismaLike = this.prisma) {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken: this.signAccessToken(user),
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email: dto.email.toLowerCase(),
        passwordHash: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account locked due to too many failed login attempts. Try again later.');
    }

    const passwordIsValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordIsValid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: failedLoginAttempts >= ACCOUNT_LOCKOUT_THRESHOLD
          ? {
              failedLoginAttempts: 0,
              lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_MS),
            }
          : {
              failedLoginAttempts,
            },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const authenticatedUser = user.failedLoginAttempts > 0 || user.lockedUntil
      ? await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      : user;

    return this.issueTokenPair(authenticatedUser);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    return this.prisma.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      return this.issueTokenPair(storedToken.user, tx);
    });
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async requestEmailVerification(userId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: token,
          emailVerificationExpiresAt: expiresAt,
        },
      });
    } catch {
      throw new NotFoundException('User not found');
    }

    return {
      token,
      expiresAt,
      message: 'Email verification token generated successfully.',
    };
  }

  async confirmEmailVerification(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid email verification token');
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      throw new BadRequestException('Email verification token has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully.' };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }
}
