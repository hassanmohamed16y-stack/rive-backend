import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../common/types/authenticated-request';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
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
