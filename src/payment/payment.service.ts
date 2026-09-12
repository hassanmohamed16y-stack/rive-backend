import { BadRequestException, Injectable, Logger } from "@nestjs/common";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  async handleWebhook(_rawBody: Buffer, _signature?: string) {
    throw new BadRequestException(
      "Stripe payment gateway is disabled. Active payment provider is Paymob (/api/v1/payments/paymob-webhook).",
    );
  }
}
