describe('JWT_SECRET requirement outside local development/test', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    jest.resetModules();
  });

  it.each(['production', 'staging', 'qa'])(
    'throws when loading auth.module without JWT_SECRET in NODE_ENV=%s',
    async (nodeEnv) => {
      jest.resetModules();
      process.env.NODE_ENV = nodeEnv;
      delete process.env.JWT_SECRET;

      await expect(import('./auth.module')).rejects.toThrow(
        'JWT_SECRET is required outside local development/test environments',
      );
    },
  );

  it.each(['development', 'test'])(
    'does not throw when loading auth.module without JWT_SECRET in NODE_ENV=%s',
    async (nodeEnv) => {
      jest.resetModules();
      process.env.NODE_ENV = nodeEnv;
      delete process.env.JWT_SECRET;

      await expect(import('./auth.module')).resolves.toBeDefined();
    },
  );

  it('does not throw when JWT_SECRET is set outside local development/test', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-secure-jwt-secret-that-is-longer-than-32-characters';

    await expect(import('./auth.module')).resolves.toBeDefined();
  });

  it('throws when constructing JwtStrategy without JWT_SECRET outside local development/test', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    const { JwtStrategy } = await import('./jwt.strategy');
    expect(() => new JwtStrategy({} as never)).toThrow(
      'JWT_SECRET is required outside local development/test environments',
    );
  });
});
