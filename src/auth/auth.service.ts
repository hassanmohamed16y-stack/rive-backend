import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { isLocalOnlyEnvironment } from '../common/utils/environment';
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

// Computed once at module load (not per login attempt) so that comparing against a
// non-existent user costs the same bcrypt work as a real user, without paying the
// (expensive) bcrypt.hash cost on every single login request.
//
// NOTE: this is not a real secret/credential. It is a bcrypt hash of a fixed,
// non-sensitive placeholder string used purely to equalize response timing
// between "user not found" and "wrong password" (mitigating user-enumeration
// via timing attacks). It is intentionally not read from config/secrets and
// is safe to keep in source. (Snyk Code may flag this as a hardcoded secret;
// that is a false positive.)
const DUMMY_HASH_FOR_TIMING = bcrypt.hashSync('dummy-password-for-timing-safety', 12);

const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';

type SafeUser = Omit<User, 'passwordHash' | 'emailVerificationToken' | 'emailVerificationExpiresAt' | 'passwordResetToken' | 'passwordResetExpiresAt' | 'failedLoginAttempts' | 'lockedUntil'>;
type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
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

    if (!user) {
      // Always run bcrypt.compare, even for a non-existent user, so that the response
      // timing for "user not found" and "wrong password" is indistinguishable.
      await bcrypt.compare(dto.password, DUMMY_HASH_FOR_TIMING);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await bcrypt.compare(dto.password, DUMMY_HASH_FOR_TIMING);
      throw new ForbiddenException('Account locked due to too many failed login attempts. Try again later.');
    }

    const passwordIsValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordIsValid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const isNowLocked = failedLoginAttempts >= ACCOUNT_LOCKOUT_THRESHOLD;
      await this.prisma.user.update({
        where: { id: user.id },
        data: isNowLocked
          ? {
              failedLoginAttempts: 0,
              lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_MS),
            }
          : {
              failedLoginAttempts,
            },
      });

      if (isNowLocked) {
        await this.auditLogService.record({
          userId: user.id,
          action: 'auth.account-locked',
          entityType: 'User',
          entityId: user.id,
          changes: { reason: 'Too many failed login attempts', lockedUntilMs: ACCOUNT_LOCKOUT_MS },
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

    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: this.hashToken(token),
          emailVerificationExpiresAt: expiresAt,
        },
      });
    } catch {
      throw new NotFoundException('User not found');
    }

    await this.emailService.sendEmailVerificationEmail(user.email, token);

    return {
      ...(isLocalOnlyEnvironment() ? { token } : {}),
      expiresAt,
      message: 'Email verification token generated successfully.',
    };
  }

  async confirmEmailVerification(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: this.hashToken(token) },
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
      throw new NotFoundException('User not found');
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

    await this.auditLogService.record({
      userId: user.id,
      action: 'auth.password-change',
      entityType: 'User',
      entityId: user.id,
      changes: { reason: 'User changed their password via change-password endpoint' },
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always return the same generic message, regardless of whether the account exists,
    // to prevent user enumeration via response differences or timing.
    if (!user) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashToken(token),
        passwordResetExpiresAt: expiresAt,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, token);

    await this.auditLogService.record({
      userId: user.id,
      action: 'auth.password-reset-requested',
      entityType: 'User',
      entityId: user.id,
      changes: { reason: 'Password reset token generated' },
    });

    return {
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      ...(isLocalOnlyEnvironment() ? { token, expiresAt } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: this.hashToken(token) },
    });

    if (!user) {
      throw new BadRequestException('Invalid password reset token');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

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

    await this.auditLogService.record({
      userId: user.id,
      action: 'auth.password-reset',
      entityType: 'User',
      entityId: user.id,
      changes: { reason: 'Password reset via forgot-password token' },
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
