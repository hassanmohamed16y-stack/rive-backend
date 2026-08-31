import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Create a checkout-session payload for an order' })
  @ApiResponse({ status: 200, description: 'Checkout session created successfully.' })
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
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentService.createCheckoutSession(dto.orderId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle raw payment provider webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook received and processed.' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload.' })
  async handleWebhook(@Req() req: Request) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = req.body as Buffer; // express.raw() provides Buffer
    return this.paymentService.handleWebhook(rawBody, signature);
  }
}
