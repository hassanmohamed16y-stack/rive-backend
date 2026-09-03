import { Controller, ForbiddenException, HttpCode, HttpStatus, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { OrdersService } from './orders.service';

/**
 * Internal-only endpoint invoked by an external scheduler (GitHub Actions scheduled
 * workflow / Cloud Scheduler / system cron) to expire lapsed PENDING order reservations,
 * replacing the previous in-process setInterval in OrdersService.
 *
 * Authenticated via a shared secret (INTERNAL_CRON_SECRET), compared using
 * timingSafeStringEqual to avoid leaking timing information about the secret. This is
 * intentionally NOT a JwtAuthGuard/RolesGuard route: it is meant to be called by
 * infrastructure, not by end users or admins.
 */
@ApiTags('internal')
@Controller('api/v1/internal')
export class InternalOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('expire-reservations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire lapsed PENDING order reservations (internal cron only)' })
  @ApiHeader({ name: 'x-internal-cron-secret', required: true })
  @ApiResponse({ status: 200, description: 'Number of reservations expired.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid internal cron secret.' })
  @ApiResponse({ status: 403, description: 'INTERNAL_CRON_SECRET is not configured on this server.' })
  async expireReservations(@Headers('x-internal-cron-secret') providedSecret?: string) {
    const expectedSecret = process.env.INTERNAL_CRON_SECRET;

    if (!expectedSecret) {
      throw new ForbiddenException('INTERNAL_CRON_SECRET is not configured');
    }

    if (!timingSafeStringEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Invalid internal cron secret');
    }

    const expiredCount = await this.ordersService.expirePendingReservations();
    return { expiredCount };
  }
}
