-- Add password reset token support to User.
ALTER TABLE "User"
    ADD COLUMN "passwordResetToken" TEXT,
    ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
