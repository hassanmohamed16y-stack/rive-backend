import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { isLocalOnlyEnvironment } from '../common/utils/environment';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './jwt.strategy';

if (!isLocalOnlyEnvironment() && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required outside local development/test environments');
}

const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret';

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
