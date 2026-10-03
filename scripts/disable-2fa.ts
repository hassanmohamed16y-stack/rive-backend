import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function disable2FA() {
  const targetEmail = (
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : process.env.ADMIN_EMAIL ?? "admin@rive.com"
  ).toLowerCase();

  console.log(`[Disable 2FA] Target email: ${targetEmail}`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!user) {
    console.error(`[Disable 2FA] User with email ${targetEmail} was not found.`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecretEnc: null,
        twoFactorEnabledAt: null,
        twoFactorLastUsedStep: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.2fa-disabled-emergency",
        entityType: "User",
        entityId: user.id,
        changes: { reason: "Two-factor authentication disabled via emergency script" },
      },
    }),
  ]);

  console.log(
    `[Disable 2FA] Successfully disabled 2FA and cleared recovery codes for ${targetEmail}.`,
  );
}

disable2FA()
  .catch((error) => {
    console.error("[Disable 2FA] Failed to disable 2FA:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
