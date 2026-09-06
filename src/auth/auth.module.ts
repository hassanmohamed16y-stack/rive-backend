import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JWT_ALGORITHM, resolveJwtSecret } from './jwt-secret.util';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './jwt.strategy';

// Resolved eagerly (and thrown on module load) so the app never boots without
// a real JWT_SECRET outside local development/test environments.
const jwtSecret = resolveJwtSecret();

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRATION ?? '1h') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        algorithm: JWT_ALGORITHM,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
