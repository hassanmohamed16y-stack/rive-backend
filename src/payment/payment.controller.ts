import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { PaymobService } from "./paymob.service";

@ApiTags("payments")
@Controller("api/v1/payments")
export class PaymentController {
  constructor(private readonly paymobService: PaymobService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: "X-Order-Access-Token",
    required: false,
    description: "Required for guest order checkout.",
  })
  @Post("create-checkout-session")
  @ApiOperation({
    summary:
      "Create or reuse Paymob Intention for an authenticated order owner, admin, or guest access-token holder",
  })
  @ApiResponse({
    status: 200,
    description: "Checkout session created successfully.",
  })
  @ApiResponse({ status: 403, description: "Unauthorized order access." })
  @ApiResponse({ status: 404, description: "Order not found." })
  @ApiResponse({ status: 400, description: "Order was already processed." })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          example: "cm123abc456def",
        },
      },
      required: ["orderId"],
    },
  })
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymobService.createCheckoutSession(dto.orderId, {
      userId: req.user?.userId,
      role: req.user?.role,
      guestAccessToken:
        typeof req.headers?.["x-order-access-token"] === "string"
          ? req.headers["x-order-access-token"]
          : undefined,
    });
  }

  @SkipThrottle()
  @Post("paymob-webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle incoming Paymob payment callbacks/webhooks" })
  @ApiResponse({ status: 200, description: "Paymob webhook received and processed." })
  @ApiResponse({ status: 400, description: "Invalid webhook payload or signature." })
  async handlePaymobWebhook(
    @Req() req: Request,
    @Query("hmac") queryHmac?: string,
  ) {
    const rawOrBody = req.body;
    return this.paymobService.handleWebhook(rawOrBody, queryHmac);
  }

  @SkipThrottle()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle payment provider webhook events (Paymob)" })
  @ApiResponse({ status: 200, description: "Webhook received and processed." })
  @ApiResponse({ status: 400, description: "Invalid webhook payload." })
  async handleWebhook(
    @Req() req: Request,
    @Query("hmac") queryHmac?: string,
  ) {
    const rawOrBody = req.body;
    const stripeSig = req.headers["stripe-signature"] as string | undefined;
    return this.paymobService.handleWebhook(
      rawOrBody,
      queryHmac || stripeSig,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @Post("refund")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Process a payment refund via Paymob (Admin only)" })
  @ApiResponse({ status: 200, description: "Refund executed successfully." })
  @ApiResponse({ status: 400, description: "Order not eligible for refund." })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required." })
  async refundPayment(@Body() dto: RefundPaymentDto) {
    return this.paymobService.refundTransaction(dto.orderId, dto.amount);
  }
}
