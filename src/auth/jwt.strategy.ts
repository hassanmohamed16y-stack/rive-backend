import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_SECRET;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret ?? 'dev-secret-key',
    });

    if (!secret && process.env.NODE_ENV === 'production') {
      this.logger.error('JWT_SECRET is not set in production. Exiting.');
      throw new Error('JWT_SECRET is required in production');
    }
  }

  async validate(payload: { userId: string; role: string }) {
    const user = await this.authService.validateUser(payload.userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, email: user.email, role: user.role };
  }
}
