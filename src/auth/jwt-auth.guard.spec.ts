import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard.handleRequest', () => {
  function createContext(): ExecutionContext {
    return {} as ExecutionContext;
  }

  it('returns the authenticated user when validation succeeds', () => {
    const guard = new JwtAuthGuard();
    const user = { id: 'user-1', userId: 'user-1', email: 'a@example.com', role: 'CUSTOMER' };

    expect(guard.handleRequest(null, user, undefined, createContext())).toBe(user);
  });

  it('throws the underlying strategy error when one is present (e.g. an expired token)', () => {
    const guard = new JwtAuthGuard();
    const underlyingError = new UnauthorizedException('jwt expired');

    expect(() => guard.handleRequest(underlyingError, false, undefined, createContext())).toThrow(underlyingError);
  });

  it('throws a generic UnauthorizedException when there is no error but also no user (missing token)', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, false, undefined, createContext())).toThrow(UnauthorizedException);
    expect(() => guard.handleRequest(null, null, undefined, createContext())).toThrow(UnauthorizedException);
  });
});
