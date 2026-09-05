import { Controller, ForbiddenException, HttpCode, HttpStatus, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { seedDatabase } from '../../prisma/seed-logic';
import { timingSafeStringEqual } from '../common/utils/timing-safe-compare';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Temporary internal endpoint used to trigger the same baseline seed
 * (admin user + categories/products) that `scripts/seed.js` runs, over HTTP.
 * This exists so the seed can be re-run once against production directly
 * (e.g. to verify `/api/v1/categories` reflects all seeded categories)
 * without needing shell access to run `node scripts/seed.js` with the
 * production DATABASE_URL.
 *
 * Authenticated via the same shared secret (INTERNAL_CRON_SECRET) as
 * InternalOrdersController, compared using timingSafeStringEqual. This is
 * intentionally NOT a JwtAuthGuard/RolesGuard route: the admin user required
 * for that guard may not exist yet until this endpoint (or the seed script)
 * has run at least once.
 *
 * Safe to call repeatedly: `seedDatabase` only performs upserts, so it never
 * duplicates rows. Remove this controller once the production data has been
 * verified and is no longer needed.
 */
@ApiTags('internal')
@Controller('api/v1/internal')
export class SeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post('seed-database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed baseline admin user, categories, and products (internal only)' })
  @ApiHeader({ name: 'x-internal-cron-secret', required: true })
  @ApiResponse({ status: 200, description: 'Database seeded successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid internal cron secret.' })
  @ApiResponse({ status: 403, description: 'INTERNAL_CRON_SECRET is not configured on this server.' })
  async seed(@Headers('x-internal-cron-secret') providedSecret?: string) {
    const expectedSecret = process.env.INTERNAL_CRON_SECRET;

    if (!expectedSecret) {
      throw new ForbiddenException('INTERNAL_CRON_SECRET is not configured');
    }

    if (!timingSafeStringEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Invalid internal cron secret');
    }

    await seedDatabase(this.prisma);

    return { status: 'ok' };
  }
}
