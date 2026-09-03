import { validateEnvironment } from './environment.validation';

describe('production environment validation', () => {
  const productionEnvironment = {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:password@db.example/rive',
    JWT_SECRET: 'a-secure-jwt-secret-that-is-longer-than-32-characters',
    JWT_EXPIRATION: '1h',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    FRONTEND_URL: 'https://store.example.com',
    ADMIN_FRONTEND_URL: 'https://admin.example.com',
    CLOUDINARY_CLOUD_NAME: 'rive',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    ADMIN_INITIAL_PASSWORD: 'strong-admin-password',
    EMAIL_PROVIDER_API_KEY: 'a-provider-api-key',
    EMAIL_FROM_ADDRESS: 'no-reply@rive.example.com',
    INTERNAL_CRON_SECRET: 'a-secure-internal-cron-secret-32-chars-min',
  };

  it('accepts a complete production configuration', () => {
    expect(() => validateEnvironment(productionEnvironment)).not.toThrow();
  });

  it('rejects missing production secrets and invalid JWT configuration', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, STRIPE_WEBHOOK_SECRET: '' }))
      .toThrow('STRIPE_WEBHOOK_SECRET');
    expect(() => validateEnvironment({ ...productionEnvironment, JWT_SECRET: 'short' }))
      .toThrow('JWT_SECRET must be at least 32 characters');
    expect(() => validateEnvironment({ ...productionEnvironment, JWT_EXPIRATION: 'forever' }))
      .toThrow('JWT_EXPIRATION');
    expect(() => validateEnvironment({ ...productionEnvironment, INTERNAL_CRON_SECRET: 'short' }))
      .toThrow('INTERNAL_CRON_SECRET must be at least 32 characters');
    expect(() => validateEnvironment({ ...productionEnvironment, EMAIL_FROM_ADDRESS: 'not-an-email' }))
      .toThrow('EMAIL_FROM_ADDRESS must be a valid email address');
  });

  it.each(['staging', 'qa'])('enforces the same required variables outside local development/test for NODE_ENV=%s', (nodeEnv) => {
    expect(() => validateEnvironment({ ...productionEnvironment, NODE_ENV: nodeEnv, JWT_SECRET: '' }))
      .toThrow('Missing required production environment variables');
    expect(() => validateEnvironment({ ...productionEnvironment, NODE_ENV: nodeEnv }))
      .not.toThrow();
  });

  it('skips strict validation for local development and test environments', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => validateEnvironment({ NODE_ENV: 'test' })).not.toThrow();
  });
});
