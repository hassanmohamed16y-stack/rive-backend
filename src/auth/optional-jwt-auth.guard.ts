import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../common/types/authenticated-request';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * "Optional" means the route works for anonymous callers (no Authorization header at all —
   * `canActivate` short-circuits to `true` below, and no JWT validation ever runs). It is NOT
   * a lenient/best-effort guard: if an Authorization header IS present but the token is
   * invalid or expired, `handleRequest` below still rejects with 401 rather than silently
   * falling back to an anonymous request. Callers relying on optional auth must omit the
   * header entirely for guest access, not send a bad token expecting it to be ignored.
   */
  canActivate(context: ExecutionContext) {
    const authorization = context.switchToHttp().getRequest().headers.authorization;
    return authorization ? super.canActivate(context) : true;
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false | null,
    _info: unknown,
    _context: ExecutionContext,
    _status?: number,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
