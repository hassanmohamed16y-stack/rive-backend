import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './jwt.strategy';

// JWT_SECRET is required in any environment other than local development/test. Staging and other
// non-local environments must never silently fall back to a shared, hardcoded secret.
const isLocalOnly = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
if (!isLocalOnly && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required outside local development/test environments');
}
const jwtSecret = process.env.JWT_SECRET ?? (isLocalOnly ? 'development-only-secret' : undefined);

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_EXPIRATION ?? '1h') as `${number}${'s' | 'm' | 'h' | 'd'}` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
