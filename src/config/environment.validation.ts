import { isLocalOnlyEnvironment } from '../common/utils/environment';

const productionRequiredVariables = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRATION',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FRONTEND_URL',
  'ADMIN_FRONTEND_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'ADMIN_INITIAL_PASSWORD',
  'EMAIL_PROVIDER_API_KEY',
  'EMAIL_FROM_ADDRESS',
  'INTERNAL_CRON_SECRET',
] as const;

export function validateEnvironment(environment = process.env) {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  if (!nodeEnvironment.trim()) {
    throw new Error('NODE_ENV must not be empty');
  }

  if (environment.PORT && (!/^\d+$/.test(environment.PORT) || Number(environment.PORT) < 1 || Number(environment.PORT) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  // Any environment other than local development/test (production, staging, qa, ...)
  // must be treated as a real deployment. See isLocalOnlyEnvironment for the single
  // source of truth for this distinction.
  if (isLocalOnlyEnvironment(nodeEnvironment)) return;

  const missingVariables = productionRequiredVariables.filter((name) => !environment[name]?.trim());
  if (missingVariables.length) {
    throw new Error(`Missing required production environment variables: ${missingVariables.join(', ')}`);
  }

  if ((environment.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if ((environment.ADMIN_INITIAL_PASSWORD?.length ?? 0) < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters in production');
  }

  if ((environment.INTERNAL_CRON_SECRET?.length ?? 0) < 32) {
    throw new Error('INTERNAL_CRON_SECRET must be at least 32 characters in production');
  }

  if (!/^\d+[smhd]$/.test(environment.JWT_EXPIRATION ?? '')) {
    throw new Error('JWT_EXPIRATION must use a number followed by s, m, h, or d');
  }

  for (const urlVariable of ['DATABASE_URL', 'FRONTEND_URL', 'ADMIN_FRONTEND_URL'] as const) {
    try {
      new URL(environment[urlVariable]!);
    } catch {
      throw new Error(`${urlVariable} must be a valid URL`);
    }
  }

  if (!environment.STRIPE_SECRET_KEY?.startsWith('sk_') || !environment.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
    throw new Error('Stripe credentials have an invalid format');
  }

  if (!environment.EMAIL_FROM_ADDRESS?.includes('@')) {
    throw new Error('EMAIL_FROM_ADDRESS must be a valid email address');
  }
}
