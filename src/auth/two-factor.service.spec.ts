import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { authenticator } from "otplib";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { encryptTwoFactorSecret } from "./utils/two-factor-crypto.util";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  hashSync: jest.fn(() => "dummy-hash"),
  compare: jest.fn(),
}));

describe("TwoFactorAuth (AuthService & JwtStrategy)", () => {
  const testEncryptionKey = crypto.randomBytes(32).toString("hex");
  const jwtSecret = "test-jwt-secret-min-32-characters-long!!";
  const jwtService = new JwtService({ secret: jwtSecret });

  const adminUser = {
    id: "admin-1",
    fullName: "RIVÉ Admin",
    email: "admin@rive.com",
    passwordHash: "stored-hash",
    role: "ADMIN",
    isActive: true,
    isBlocked: false,
    emailVerifiedAt: new Date(),
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    twoFactorSecretEnc: null as string | null,
    twoFactorEnabledAt: null as Date | null,
    twoFactorLastUsedStep: null as number | null,
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
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
      twoFactorRecoveryCode: {
        count: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      systemSettings: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    const emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      prisma as any,
      jwtService,
      auditLogService as any,
      emailService as any,
    );
    const jwtStrategy = new JwtStrategy(service);

    return { service, jwtStrategy, prisma, auditLogService, emailService };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  });

  describe("When TWO_FACTOR_ENCRYPTION_KEY is NOT set", () => {
    it("returns 503 for all 2FA endpoints", async () => {
      const { service } = createService();

      await expect(service.setupTwoFactor("admin-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(
        service.enableTwoFactor("admin-1", { code: "123456" }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.disableTwoFactor("admin-1", {
          password: "pass",
          code: "123456",
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.regenerateRecoveryCodes("admin-1", {
          password: "pass",
          code: "123456",
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.getTwoFactorStatus("admin-1"),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.verifyTwoFactorLogin({
          twoFactorToken: "fake",
          code: "123456",
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

    it("login returns 503 if user has 2FA enabled but TWO_FACTOR_ENCRYPTION_KEY is missing", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorEnabledAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({
          email: adminUser.email,
          password: "Password123!",
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("login proceeds unaffected for users WITHOUT 2FA enabled when key is missing", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorEnabledAt: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({ id: "rf-1" });

      const result = (await service.login({
        email: adminUser.email,
        password: "Password123!",
      })) as any;

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).not.toHaveProperty("twoFactorRequired");
    });
  });

  describe("When TWO_FACTOR_ENCRYPTION_KEY is set", () => {
    beforeEach(() => {
      process.env.TWO_FACTOR_ENCRYPTION_KEY = testEncryptionKey;
    });

    it("setupTwoFactor generates base32 secret and otpauthUri and saves encrypted secret", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.user.update.mockResolvedValue(adminUser);

      const res = await service.setupTwoFactor(adminUser.id);

      expect(res.secret).toBeDefined();
      expect(res.otpauthUri).toContain("otpauth://totp/");
      expect(res.otpauthUri).toContain(encodeURIComponent(adminUser.email));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adminUser.id },
          data: expect.objectContaining({
            twoFactorSecretEnc: expect.stringMatching(/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/),
          }),
        }),
      );
    });

    it("setupTwoFactor throws 409 if 2FA is already enabled", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorEnabledAt: new Date(),
      });

      await expect(service.setupTwoFactor(adminUser.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("enableTwoFactor verifies code, sets twoFactorEnabledAt, and returns 10 recovery codes", async () => {
      const { service, prisma, auditLogService } = createService();
      const plainSecret = authenticator.generateSecret();
      const encryptedSecret = encryptTwoFactorSecret(plainSecret, testEncryptionKey);

      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorSecretEnc: encryptedSecret,
      });

      authenticator.options = { window: 1 };
      const validCode = authenticator.generate(plainSecret);

      const res = await service.enableTwoFactor(adminUser.id, { code: validCode });

      expect(res.recoveryCodes).toHaveLength(10);
      expect(prisma.twoFactorRecoveryCode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: adminUser.id, codeHash: expect.any(String) }),
        ]),
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.2fa-enabled" }),
      );
    });

    it("enableTwoFactor rejects replayed code (same step)", async () => {
      const { service, prisma } = createService();
      const plainSecret = authenticator.generateSecret();
      const encryptedSecret = encryptTwoFactorSecret(plainSecret, testEncryptionKey);
      authenticator.options = { window: 1 };
      const validCode = authenticator.generate(plainSecret);
      const currentStep = Math.floor(Date.now() / 1000 / 30);

      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorSecretEnc: encryptedSecret,
        twoFactorLastUsedStep: currentStep,
      });

      await expect(
        service.enableTwoFactor(adminUser.id, { code: validCode }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("disableTwoFactor verifies password and TOTP code, then clears 2FA data", async () => {
      const { service, prisma, auditLogService } = createService();
      const plainSecret = authenticator.generateSecret();
      const encryptedSecret = encryptTwoFactorSecret(plainSecret, testEncryptionKey);
      authenticator.options = { window: 1 };
      const validCode = authenticator.generate(plainSecret);

      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorSecretEnc: encryptedSecret,
        twoFactorEnabledAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.disableTwoFactor(adminUser.id, {
        password: "Password123!",
        code: validCode,
      });

      expect(res.message).toMatch(/disabled successfully/i);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            twoFactorSecretEnc: null,
            twoFactorEnabledAt: null,
            twoFactorLastUsedStep: null,
          },
        }),
      );
      expect(prisma.twoFactorRecoveryCode.deleteMany).toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.2fa-disabled" }),
      );
    });

    it("disableTwoFactor accepts a valid unused recovery code", async () => {
      const { service, prisma } = createService();
      const recoveryCode = "A1B2C3D4E5";
      const recoveryHash = crypto
        .createHash("sha256")
        .update(recoveryCode)
        .digest("hex");

      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorEnabledAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.twoFactorRecoveryCode.findMany.mockResolvedValue([
        { id: "rc-1", userId: adminUser.id, codeHash: recoveryHash, usedAt: null },
      ]);

      const res = await service.disableTwoFactor(adminUser.id, {
        password: "Password123!",
        code: recoveryCode,
      });

      expect(res.message).toMatch(/disabled successfully/i);
    });

    it("regenerateRecoveryCodes invalidates old codes and returns 10 new ones", async () => {
      const { service, prisma, auditLogService } = createService();
      const plainSecret = authenticator.generateSecret();
      const encryptedSecret = encryptTwoFactorSecret(plainSecret, testEncryptionKey);
      authenticator.options = { window: 1 };
      const validCode = authenticator.generate(plainSecret);

      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorSecretEnc: encryptedSecret,
        twoFactorEnabledAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.regenerateRecoveryCodes(adminUser.id, {
        password: "Password123!",
        code: validCode,
      });

      expect(res.recoveryCodes).toHaveLength(10);
      expect(prisma.twoFactorRecoveryCode.deleteMany).toHaveBeenCalled();
      expect(prisma.twoFactorRecoveryCode.createMany).toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.2fa-recovery-codes-regenerated" }),
      );
    });

    it("getTwoFactorStatus returns status, remaining recovery codes, and enforcement", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        twoFactorEnabledAt: new Date(),
      });
      prisma.twoFactorRecoveryCode.count.mockResolvedValue(8);
      prisma.systemSettings.findUnique.mockResolvedValue({ enforce2FAGlobally: true });

      const res = await service.getTwoFactorStatus(adminUser.id);

      expect(res).toEqual({
        enabled: true,
        recoveryCodesRemaining: 8,
        enforced: true,
      });
    });

    describe("Login flow with 2FA enabled", () => {
      it("login returns twoFactorRequired and twoFactorToken, without access or refresh tokens", async () => {
        const { service, prisma } = createService();
        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          twoFactorEnabledAt: new Date(),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        const res = (await service.login({
          email: adminUser.email,
          password: "Password123!",
        })) as any;

        expect(res.twoFactorRequired).toBe(true);
        expect(res.twoFactorToken).toBeDefined();
        expect(res.accessToken).toBeUndefined();
        expect(res.refreshToken).toBeUndefined();

        const decoded = jwtService.verify(res.twoFactorToken);
        expect(decoded.sub).toBe(adminUser.id);
        expect(decoded.purpose).toBe("2fa");
        expect(decoded.jti).toBeDefined();
      });

      it("JwtStrategy rejects any token with purpose '2fa'", async () => {
        const { jwtStrategy, prisma } = createService();
        prisma.user.findUnique.mockResolvedValue(adminUser);

        const twoFactorTokenPayload = {
          sub: adminUser.id,
          purpose: "2fa",
        };

        await expect(
          jwtStrategy.validate(twoFactorTokenPayload),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it("verifyTwoFactorLogin issues normal token pair for valid TOTP code", async () => {
        const { service, prisma } = createService();
        const plainSecret = authenticator.generateSecret();
        const encryptedSecret = encryptTwoFactorSecret(plainSecret, testEncryptionKey);
        authenticator.options = { window: 1 };
        const validCode = authenticator.generate(plainSecret);

        const twoFactorToken = jwtService.sign({
          sub: adminUser.id,
          purpose: "2fa",
          jti: "test-jti",
        });

        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          twoFactorSecretEnc: encryptedSecret,
          twoFactorEnabledAt: new Date(),
        });
        prisma.refreshToken.create.mockResolvedValue({ id: "rf-1" });

        const res = (await service.verifyTwoFactorLogin({
          twoFactorToken,
          code: validCode,
        })) as any;

        expect(res.accessToken).toBeDefined();
        expect(res.refreshToken).toBeDefined();
        expect(res.user).toBeDefined();
        expect(res.requires2FA).toBe(false);
      });

      it("verifyTwoFactorLogin issues token pair for valid single-use recovery code", async () => {
        const { service, prisma } = createService();
        const recoveryCode = "X9Y8Z7W6V5";
        const recoveryHash = crypto
          .createHash("sha256")
          .update(recoveryCode)
          .digest("hex");

        const twoFactorToken = jwtService.sign({
          sub: adminUser.id,
          purpose: "2fa",
          jti: "test-jti",
        });

        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          twoFactorEnabledAt: new Date(),
        });
        prisma.twoFactorRecoveryCode.findMany.mockResolvedValue([
          { id: "rc-10", userId: adminUser.id, codeHash: recoveryHash, usedAt: null },
        ]);
        prisma.refreshToken.create.mockResolvedValue({ id: "rf-2" });

        const res = (await service.verifyTwoFactorLogin({
          twoFactorToken,
          code: recoveryCode,
        })) as any;

        expect(res.accessToken).toBeDefined();
        expect(prisma.twoFactorRecoveryCode.update).toHaveBeenCalledWith({
          where: { id: "rc-10" },
          data: { usedAt: expect.any(Date) },
        });
      });

      it("verifyTwoFactorLogin locks account after 5 failed code attempts", async () => {
        const { service, prisma, auditLogService } = createService();
        const twoFactorToken = jwtService.sign({
          sub: adminUser.id,
          purpose: "2fa",
          jti: "test-jti",
        });

        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          failedLoginAttempts: 4,
        });
        prisma.twoFactorRecoveryCode.findMany.mockResolvedValue([]);

        await expect(
          service.verifyTwoFactorLogin({
            twoFactorToken,
            code: "999999",
          }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              failedLoginAttempts: 0,
              lockedUntil: expect.any(Date),
            }),
          }),
        );
        expect(auditLogService.record).toHaveBeenCalledWith(
          expect.objectContaining({ action: "auth.account-locked" }),
        );
      });

      it("returns 503 during login if user has 2FA enabled but TWO_FACTOR_ENCRYPTION_KEY is missing", async () => {
        delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
        const { service, prisma } = createService();
        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          twoFactorEnabledAt: new Date(),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(
          service.login({
            email: adminUser.email,
            password: "Password123!",
          }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
      });

      it("rejects 2fa token on refresh endpoint", async () => {
        const { service, prisma } = createService();
        const twoFactorToken = jwtService.sign({
          sub: adminUser.id,
          purpose: "2fa",
          jti: "test-jti",
        });

        prisma.refreshToken.findFirst.mockResolvedValue(null);

        await expect(
          service.refresh(twoFactorToken),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });
    });

    describe("Global 2FA Enforcement semantics", () => {
      it("when enforce2FAGlobally is true and admin has not enabled 2FA, logs in with requires2FA: true and requires2FASetup: true", async () => {
        const { service, prisma } = createService();
        prisma.user.findUnique.mockResolvedValue({
          ...adminUser,
          twoFactorEnabledAt: null,
        });
        prisma.systemSettings.findUnique.mockResolvedValue({
          enforce2FAGlobally: true,
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        prisma.refreshToken.create.mockResolvedValue({ id: "rf-3" });

        const res = (await service.login({
          email: adminUser.email,
          password: "Password123!",
        })) as any;

        expect(res.accessToken).toBeDefined();
        expect(res.requires2FA).toBe(true);
        expect(res.requires2FASetup).toBe(true);
      });
    });
  });
});
