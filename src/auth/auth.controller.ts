import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailVerificationDto } from "./dto/confirm-email-verification.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { TwoFactorDisableDto } from "./dto/two-factor-disable.dto";
import { TwoFactorEnableDto } from "./dto/two-factor-enable.dto";
import { TwoFactorVerifyDto } from "./dto/two-factor-verify.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  @ApiOperation({ summary: "Register a new customer account" })
  @ApiResponse({ status: 201, description: "User registered successfully." })
  @ApiResponse({ status: 409, description: "User already exists." })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post("login")
  @ApiOperation({ summary: "Log in and receive a JWT access token" })
  @ApiResponse({ status: 201, description: "Login successful." })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  @ApiOperation({
    summary: "Rotate a refresh token and issue a new token pair",
  })
  @ApiResponse({
    status: 201,
    description: "Token pair refreshed successfully.",
  })
  @ApiResponse({
    status: 401,
    description: "Refresh token is invalid or expired.",
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a refresh token" })
  @ApiResponse({ status: 200, description: "Logout completed successfully." })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("verify-email/request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Generate an email verification token for the current user",
  })
  @ApiResponse({
    status: 201,
    description: "Verification token generated successfully.",
  })
  async requestEmailVerification(
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.authService.requestEmailVerification(req.user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("verify-email/confirm")
  @ApiOperation({ summary: "Confirm email verification using a token" })
  @ApiResponse({ status: 201, description: "Email verified successfully." })
  async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
    return this.authService.confirmEmailVerification(dto.token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user profile" })
  @ApiResponse({
    status: 200,
    description: "Current user profile returned successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  async me(@Req() req: Request & { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Change the authenticated user password and revoke all active refresh tokens",
  })
  @ApiResponse({ status: 200, description: "Password changed successfully." })
  @ApiResponse({ status: 401, description: "Current password is incorrect." })
  async changePassword(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a password reset token via email" })
  @ApiResponse({
    status: 200,
    description: "A generic confirmation message is always returned.",
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset the password using a valid password reset token",
  })
  @ApiResponse({ status: 200, description: "Password reset successfully." })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired password reset token.",
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Initiate 2FA setup and get TOTP secret and URI" })
  @ApiResponse({
    status: 201,
    description: "2FA setup initiated successfully.",
  })
  @ApiResponse({ status: 409, description: "2FA is already enabled." })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async setupTwoFactor(@Req() req: Request & { user: { id: string } }) {
    return this.authService.setupTwoFactor(req.user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Enable 2FA using a valid TOTP code" })
  @ApiResponse({
    status: 201,
    description: "2FA enabled successfully and recovery codes returned.",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid code or setup not initiated.",
  })
  @ApiResponse({ status: 409, description: "2FA is already enabled." })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async enableTwoFactor(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: TwoFactorEnableDto,
  ) {
    return this.authService.enableTwoFactor(req.user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("2fa/disable")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Disable 2FA requiring current password and code" })
  @ApiResponse({ status: 200, description: "2FA disabled successfully." })
  @ApiResponse({ status: 401, description: "Invalid password or 2FA code." })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async disableTwoFactor(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.authService.disableTwoFactor(req.user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("2fa/regenerate-recovery-codes")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Regenerate 2FA recovery codes requiring password and code",
  })
  @ApiResponse({
    status: 200,
    description: "New recovery codes generated successfully.",
  })
  @ApiResponse({ status: 401, description: "Invalid password or 2FA code." })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async regenerateRecoveryCodes(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.authService.regenerateRecoveryCodes(req.user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get("2fa/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user 2FA status" })
  @ApiResponse({
    status: 200,
    description: "2FA status returned successfully.",
  })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async getTwoFactorStatus(@Req() req: Request & { user: { id: string } }) {
    return this.authService.getTwoFactorStatus(req.user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify 2FA login token and TOTP or recovery code" })
  @ApiResponse({
    status: 200,
    description:
      "2FA login verification successful, token pair returned.",
  })
  @ApiResponse({ status: 401, description: "Invalid 2FA token or code." })
  @ApiResponse({
    status: 403,
    description: "Account locked due to too many failed login attempts.",
  })
  @ApiResponse({
    status: 503,
    description: "Two-factor authentication is not configured.",
  })
  async verifyTwoFactorLogin(@Body() dto: TwoFactorVerifyDto) {
    return this.authService.verifyTwoFactorLogin(dto);
  }
}
