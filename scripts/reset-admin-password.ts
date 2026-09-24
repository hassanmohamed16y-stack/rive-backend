import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const targetEmail = (process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : process.env.ADMIN_EMAIL ?? "admin@rive.com"
  ).toLowerCase();

  const newPassword =
    process.argv[3] ||
    (process.argv[2] && process.argv[2].length > 0 && !process.argv[2].includes("@")
      ? process.argv[2]
      : process.env.ADMIN_INITIAL_PASSWORD) ||
    "development-only-admin-password";

  console.log(`[Reset Admin] Target email: ${targetEmail}`);

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const fullAdminRole = await prisma.role.findUnique({
    where: { name: "full_admin" },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        role: UserRole.ADMIN,
        ...(fullAdminRole ? { roleId: fullAdminRole.id } : {}),
      },
    });
    console.log(
      `[Reset Admin] Successfully reset password and unlocked account for ${targetEmail}.`,
    );
  } else {
    await prisma.user.create({
      data: {
        fullName: "RIVÉ Admin",
        email: targetEmail,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
        ...(fullAdminRole ? { roleId: fullAdminRole.id } : {}),
      },
    });
    console.log(
      `[Reset Admin] Admin account ${targetEmail} did not exist and has been created.`,
    );
  }

  console.log(`[Reset Admin] New admin password set to: ${newPassword}`);
}

resetAdminPassword()
  .catch((error) => {
    console.error("[Reset Admin] Failed to reset admin password:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
