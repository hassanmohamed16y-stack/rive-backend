import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const authorization = context.switchToHttp().getRequest().headers.authorization;
    return authorization ? super.canActivate(context) : true;
  }

  handleRequest<TUser = any>(err: any, user: TUser, _info: any, _context: ExecutionContext, _status?: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
