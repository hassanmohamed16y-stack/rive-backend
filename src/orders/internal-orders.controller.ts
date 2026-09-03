import { Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { OrdersService } from './orders.service';

@ApiTags('internal')
@Controller('api/v1/internal')
export class InternalOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('expire-reservations')
  @ApiHeader({ name: 'X-Internal-Cron-Secret', required: true })
  @ApiOperation({ summary: 'Expire pending reservations (external scheduler only)' })
  @ApiResponse({ status: 201, description: 'Expired reservation count returned.' })
  async expireReservations(@Headers('x-internal-cron-secret') secret?: string) {
    if (!timingSafeStringEqual(process.env.INTERNAL_CRON_SECRET, secret)) {
      throw new ForbiddenException('Invalid internal cron secret');
    }
    return { expiredCount: await this.ordersService.expirePendingReservations() };
  }
}
