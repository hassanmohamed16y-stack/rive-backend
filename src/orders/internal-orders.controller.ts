import { ForbiddenException, Headers, HttpCode, Post, Controller } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { OrdersService } from './orders.service';

@ApiTags('internal')
@Controller('api/v1/internal')
export class InternalOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private assertCronSecret(secret?: string) {
    const configuredSecret = process.env.INTERNAL_CRON_SECRET;

    if (!configuredSecret || !timingSafeStringEqual(configuredSecret, secret)) {
      throw new ForbiddenException('Invalid internal cron secret');
    }
  }

  @Post('expire-reservations')
  @HttpCode(200)
  @ApiHeader({
    name: 'x-internal-cron-secret',
    required: true,
    description: 'Shared secret for the external scheduler that expires pending order reservations.',
  })
  @ApiOperation({ summary: 'Expire pending order reservations for the external scheduler' })
  @ApiResponse({ status: 200, description: 'Expired pending reservations successfully.' })
  @ApiResponse({ status: 403, description: 'Invalid or missing internal cron secret.' })
  async expireReservations(@Headers('x-internal-cron-secret') secret?: string) {
    this.assertCronSecret(secret);

    return {
      expiredCount: await this.ordersService.expirePendingReservations(),
    };
  }
}
