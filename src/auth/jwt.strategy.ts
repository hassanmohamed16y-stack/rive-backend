import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { JWT_ALGORITHM, resolveJwtSecret } from './jwt-secret.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: { userId?: string; sub?: string; role?: string; email?: string; id?: string }) {
    const userId = payload.userId ?? payload.sub ?? payload.id;
    if (!userId) {
      this.logger.warn('Rejected JWT: payload is missing a user identifier');
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateUser(userId);
    if (!user) {
      this.logger.warn(`Rejected JWT: user ${userId} no longer exists`);
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
