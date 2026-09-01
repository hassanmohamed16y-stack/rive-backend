import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret';
const isProduction = process.env.NODE_ENV === 'production';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    if (isProduction && !process.env.JWT_SECRET) {
      this.logger.error('JWT_SECRET is required in production.');
      throw new Error('JWT_SECRET is required in production');
    }
  }

  async validate(payload: { userId?: string; sub?: string; role?: string; email?: string }) {
    const userId = payload.userId ?? payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateUser(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
