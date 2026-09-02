import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 409, description: 'User already exists.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Log in and receive a JWT access token' })
  @ApiResponse({ status: 201, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token and issue a new token pair' })
  @ApiResponse({ status: 201, description: 'Token pair refreshed successfully.' })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid or expired.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({ status: 200, description: 'Logout completed successfully.' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('verify-email/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate an email verification token for the current user' })
  @ApiResponse({ status: 201, description: 'Verification token generated successfully.' })
  async requestEmailVerification(@Req() req: Request & { user: { id: string } }) {
    return this.authService.requestEmailVerification(req.user.id);
  }

  @Post('verify-email/confirm')
  @ApiOperation({ summary: 'Confirm email verification using a token' })
  @ApiResponse({ status: 201, description: 'Email verified successfully.' })
  async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
    return this.authService.confirmEmailVerification(dto.token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async me(@Req() req: Request & { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }
}
