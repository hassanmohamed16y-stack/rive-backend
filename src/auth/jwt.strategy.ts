import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isLocalOnlyEnvironment } from '../common/utils/environment';
import { AuthService } from './auth.service';

const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    if (!isLocalOnlyEnvironment() && !process.env.JWT_SECRET) {
      this.logger.error('JWT_SECRET is required outside local development/test environments.');
      throw new Error('JWT_SECRET is required outside local development/test environments');
    }
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
