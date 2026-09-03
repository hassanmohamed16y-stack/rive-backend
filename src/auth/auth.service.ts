import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type UserRole = 'ADMIN' | 'CUSTOMER';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_LOCKOUT_THRESHOLD = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;
// Precomputed bcrypt hash of a fixed dummy password. Used to keep bcrypt.compare timing
// constant regardless of whether the requested email exists, preventing user-enumeration
// via response-time analysis on the login endpoint.
const DUMMY_PASSWORD_HASH = '$2b$12$K/QXHSXlc1z479RjMRIV9u9FnDNRmoDm7r0ppIBkwYqsOPfiRQ7oG';

type SafeUser = Omit<User, 'passwordHash' | 'emailVerificationToken' | 'emailVerificationExpiresAt' | 'passwordResetToken' | 'passwordResetExpiresAt' | 'failedLoginAttempts' | 'lockedUntil'>;
type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private sanitizeUser(user: User): SafeUser {
    const {
      passwordHash: _passwordHash,
      emailVerificationToken: _emailVerificationToken,
      emailVerificationExpiresAt: _emailVerificationExpiresAt,
      passwordResetToken: _passwordResetToken,
      passwordResetExpiresAt: _passwordResetExpiresAt,
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

    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account locked due to too many failed login attempts. Try again later.');
    }

    // Always run bcrypt.compare, even for unknown emails, using a precomputed dummy hash so the
    // response time is indistinguishable between "user not found" and "wrong password". This
    // prevents user enumeration via timing analysis on the login endpoint.
    const passwordIsValid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordIsValid) {
      if (user) {
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
      }
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
    let user: User;

    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: token,
          emailVerificationExpiresAt: expiresAt,
        },
      });
    } catch {
      throw new NotFoundException('User not found');
    }

    const verificationLink = `${(process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/verify-email?token=${token}`;

    if (process.env.NODE_ENV === 'production') {
      await this.emailService.send({
        to: user.email,
        ...this.emailService.buildEmailVerificationEmail(verificationLink),
      });

      return {
        message: 'Email verification token generated successfully. Check your inbox for the verification link.',
      };
    }

    // TODO(non-production only): the token is returned directly here purely to ease local/manual
    // testing when a real email provider is not configured. This branch must never run in production.
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentPasswordIsValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordIsValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password changed successfully. Please log in again on all devices.' };
  }

  async forgotPassword(dto: { email: string }) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always return the same message regardless of whether the account exists, to avoid
    // leaking which email addresses are registered (user enumeration).
    const genericResponse = { message: 'If this email exists, a reset link was sent.' };

    if (!user) {
      return genericResponse;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetLink = `${(process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/reset-password?token=${token}`;

    if (process.env.NODE_ENV === 'production') {
      await this.emailService.send({
        to: user.email,
        ...this.emailService.buildPasswordResetEmail(resetLink),
      });

      return genericResponse;
    }

    // TODO(non-production only): the token is returned directly here purely to ease local/manual
    // testing when a real email provider is not configured. This branch must never run in production.
    return { ...genericResponse, token, expiresAt };
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid password reset token');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password reset successfully. Please log in again.' };
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
