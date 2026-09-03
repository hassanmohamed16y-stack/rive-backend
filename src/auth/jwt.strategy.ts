import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

// JWT_SECRET is required in any environment other than local development/test. Staging and other
// non-local environments must never silently fall back to a shared, hardcoded secret.
const isLocalOnly = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const jwtSecret = process.env.JWT_SECRET ?? (isLocalOnly ? 'development-only-secret' : undefined);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    if (!isLocalOnly && !process.env.JWT_SECRET) {
      const logger = new Logger(JwtStrategy.name);
      logger.error('JWT_SECRET is required outside local development/test environments.');
      throw new Error('JWT_SECRET is required outside local development/test environments');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret as string,
    });
  }

  async validate(payload: { userId?: string; sub?: string; role?: string; email?: string; id?: string }) {
    const userId = payload.userId ?? payload.sub ?? payload.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateUser(userId);
    if (!user) {
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
