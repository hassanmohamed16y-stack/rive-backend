import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isLocalOnlyEnvironment } from '../common/utils/environment';
import { AuthService } from './auth.service';

/**
 * Resolves the JWT signing/verification secret. Fails fast (throws) if
 * JWT_SECRET is missing outside local development/test environments, so the
 * app never boots with (and never even constructs Passport with) the
 * insecure development fallback secret in a real deployment. This is the
 * only place the fallback secret is used.
 */
function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  if (!isLocalOnlyEnvironment()) {
    throw new Error('JWT_SECRET is required outside local development/test environments');
  }

  return 'development-only-secret';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
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
