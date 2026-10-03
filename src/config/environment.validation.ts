import { isLocalOnlyEnvironment } from "../common/utils/environment";
import { getTwoFactorEncryptionKey } from "../auth/utils/two-factor-crypto.util";

const productionRequiredVariables = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_EXPIRATION",
  "PAYMOB_API_KEY",
  "PAYMOB_HMAC_SECRET",
  "PAYMOB_INTEGRATION_ID_CARD",
  "FRONTEND_URL",
  "ADMIN_FRONTEND_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "ADMIN_INITIAL_PASSWORD",
  "EMAIL_PROVIDER_API_KEY",
  "EMAIL_FROM_ADDRESS",
  "INTERNAL_CRON_SECRET",
] as const;

export function validateEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  const nodeEnvironment = environment.NODE_ENV;
  if (nodeEnvironment !== undefined && !nodeEnvironment.trim()) {
    throw new Error("NODE_ENV must not be empty");
  }

  if (
    environment.PORT &&
    (!/^\d+$/.test(environment.PORT) ||
      Number(environment.PORT) < 1 ||
      Number(environment.PORT) > 65535)
  ) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  // Any environment other than local development/test (production, staging, qa, ...)
  // must be treated as a real deployment. See isLocalOnlyEnvironment for the single
  // source of truth for this distinction.
  if (isLocalOnlyEnvironment(nodeEnvironment, environment)) return;

  const missingVariables = productionRequiredVariables.filter(
    (name) => !environment[name]?.trim(),
  );
  if (missingVariables.length) {
    throw new Error(
      `[CRITICAL SERVER STARTUP ERROR / خطأ حرجي عند تشغيل السيرفر] ` +
      `Missing required environment variable(s) / المتغيرات البيئية التالية مفقودة أو فارغة: ` +
      `${missingVariables.join(", ")}`,
    );
  }

  if ((environment.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  if ((environment.ADMIN_INITIAL_PASSWORD?.length ?? 0) < 12) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD must be at least 12 characters in production",
    );
  }

  if ((environment.INTERNAL_CRON_SECRET?.length ?? 0) < 32) {
    throw new Error(
      "INTERNAL_CRON_SECRET must be at least 32 characters in production",
    );
  }

  if (!/^\d+[smhd]$/.test(environment.JWT_EXPIRATION ?? "")) {
    throw new Error(
      "JWT_EXPIRATION must use a number followed by s, m, h, or d",
    );
  }

  for (const urlVariable of [
    "DATABASE_URL",
    "FRONTEND_URL",
    "ADMIN_FRONTEND_URL",
  ] as const) {
    try {
      new URL(environment[urlVariable]!);
    } catch {
      throw new Error(`${urlVariable} must be a valid URL`);
    }
  }

  if (!/^\d+$/.test(environment.PAYMOB_INTEGRATION_ID_CARD ?? "")) {
    throw new Error("PAYMOB_INTEGRATION_ID_CARD must be a numeric ID");
  }

  if (
    environment.STRIPE_SECRET_KEY &&
    !environment.STRIPE_SECRET_KEY.startsWith("sk_")
  ) {
    throw new Error("Stripe credentials have an invalid format");
  }

  if (!environment.EMAIL_FROM_ADDRESS?.includes("@")) {
    throw new Error("EMAIL_FROM_ADDRESS must be a valid email address");
  }

  if (environment.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    try {
      JSON.parse(environment.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be a valid JSON string");
    }
  }

  if (
    environment.META_APP_SECRET !== undefined &&
    !environment.META_APP_SECRET.trim()
  ) {
    throw new Error("META_APP_SECRET must not be empty if specified");
  }

  if (
    environment.META_PAGE_ACCESS_TOKEN !== undefined &&
    !environment.META_PAGE_ACCESS_TOKEN.trim()
  ) {
    throw new Error("META_PAGE_ACCESS_TOKEN must not be empty if specified");
  }

  if (
    environment.TWO_FACTOR_ENCRYPTION_KEY !== undefined &&
    environment.TWO_FACTOR_ENCRYPTION_KEY.trim() !== ""
  ) {
    try {
      getTwoFactorEncryptionKey(environment.TWO_FACTOR_ENCRYPTION_KEY);
    } catch {
      throw new Error(
        "TWO_FACTOR_ENCRYPTION_KEY must be a valid 32-byte key (64 hex characters, base64, or 32 raw bytes)",
      );
    }
  }
}
