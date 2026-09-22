import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
import { RolesController } from "./roles.controller";
import { UsersController } from "./users.controller";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JWT_ALGORITHM, resolveJwtSecret } from "./jwt-secret.util";
import { RolesGuard } from "./roles.guard";
import { PermissionsGuard } from "./permissions.guard";
import { JwtStrategy } from "./jwt.strategy";

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
        expiresIn: (process.env.JWT_EXPIRATION ??
          "1h") as `${number}${"s" | "m" | "h" | "d"}`,
        algorithm: JWT_ALGORITHM,
      },
    }),
  ],
  controllers: [
    AuthController,
    AdminUsersController,
    UsersController,
    RolesController,
  ],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [AuthService, UsersService, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class AuthModule {}
