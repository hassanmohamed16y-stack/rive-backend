import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-key',
    });
  }

  async validate(payload: { userId: string; role: string }) {
    const user = await this.authService.validateUser(payload.userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, email: user.email, role: user.role };
  }
}
