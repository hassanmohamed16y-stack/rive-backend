import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  function createContext(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('allows the request through immediately (anonymous/guest access) when no Authorization header is present', () => {
      const guard = new OptionalJwtAuthGuard();

      expect(guard.canActivate(createContext(undefined))).toBe(true);
    });

    it('delegates to the underlying JWT strategy validation when an Authorization header is present', () => {
      const guard = new OptionalJwtAuthGuard();
      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(createContext('******'));

      expect(superCanActivateSpy).toHaveBeenCalled();
      expect(result).toBe(true);
      superCanActivateSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    it('returns the authenticated user when a token was present and valid', () => {
      const guard = new OptionalJwtAuthGuard();
      const user = { id: 'user-1', userId: 'user-1', email: 'a@example.com', role: 'CUSTOMER' };

      expect(guard.handleRequest(null, user, undefined, createContext('******'))).toBe(user);
    });

    it('rejects with 401 when an Authorization header was present but the token is invalid or expired (does not silently fall back to anonymous)', () => {
      const guard = new OptionalJwtAuthGuard();

      expect(() => guard.handleRequest(null, false, undefined, createContext('******')))
        .toThrow(UnauthorizedException);
    });

    it('propagates the underlying strategy error when present', () => {
      const guard = new OptionalJwtAuthGuard();
      const underlyingError = new UnauthorizedException('jwt expired');

      expect(() => guard.handleRequest(underlyingError, false, undefined, createContext('******')))
        .toThrow(underlyingError);
    });
  });
});
