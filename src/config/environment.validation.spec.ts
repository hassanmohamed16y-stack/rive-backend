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
  });
});
