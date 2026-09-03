describe('JWT_SECRET hardening outside local development/test', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  function loadAuthModuleWithEnv(nodeEnv: string, jwtSecret?: string) {
    jest.resetModules();
    process.env.NODE_ENV = nodeEnv;
    if (jwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = jwtSecret;
    }

    // Must re-require after jest.resetModules() so the module-level check re-runs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return () => require('./auth.module');
  }

  it.each(['production', 'staging', 'qa'])('throws when JWT_SECRET is missing for NODE_ENV=%s', (nodeEnv) => {
    expect(loadAuthModuleWithEnv(nodeEnv)).toThrow(
      'JWT_SECRET is required outside local development/test environments',
    );
  });

  it.each(['production', 'staging', 'qa'])('does not throw when JWT_SECRET is set for NODE_ENV=%s', (nodeEnv) => {
    expect(loadAuthModuleWithEnv(nodeEnv, 'a-secure-jwt-secret-that-is-long-enough')).not.toThrow();
  });

  it.each(['development', 'test'])('does not throw when JWT_SECRET is missing for local NODE_ENV=%s', (nodeEnv) => {
    expect(loadAuthModuleWithEnv(nodeEnv)).not.toThrow();
  });
});
