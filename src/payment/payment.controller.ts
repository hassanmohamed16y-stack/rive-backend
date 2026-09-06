import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Order-Access-Token', required: false, description: 'Required for guest order checkout.' })
  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Create or reuse Checkout for an authenticated order owner, admin, or guest access-token holder' })
  @ApiResponse({ status: 200, description: 'Checkout session created successfully.' })
  @ApiResponse({ status: 403, description: 'Unauthorized order access.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  @ApiResponse({ status: 400, description: 'Order was already processed.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          example: 'cm123abc456def',
        },
      },
      required: ['orderId'],
    },
  })
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto, @Req() req: AuthenticatedRequest) {
    return this.paymentService.createCheckoutSession(dto.orderId, {
      userId: req.user?.userId,
      role: req.user?.role,
      guestAccessToken: typeof req.headers?.['x-order-access-token'] === 'string'
        ? req.headers['x-order-access-token']
        : undefined,
    });
  }

  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle raw payment provider webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook received and processed.' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload.' })
  async handleWebhook(@Req() req: Request) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    // req.body is a Buffer (not parsed JSON) only because this route is registered with
    // express.raw() ahead of the global body parser — see app.config.ts's raw-body
    // middleware registration, which is scoped specifically to this webhook path so Stripe's
    // signature verification can run against the exact bytes received. If that middleware
    // registration ever changes, this cast would silently start receiving a parsed object here.
    const rawBody = req.body as Buffer;
    return this.paymentService.handleWebhook(rawBody, signature);
  }
}
