import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { WhatsAppService } from "./whatsapp.service";
import { MetaSignatureGuard } from "../common/guards/meta-signature.guard";

@ApiTags("whatsapp")
@Controller("api/v1/integrations/whatsapp")
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @SkipThrottle()
  @Get("webhook")
  @ApiOperation({ summary: "Verify WhatsApp Business API webhook challenge" })
  verifyWebhook(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.whatsAppService.verifyWebhookChallenge(mode, token, challenge);
  }

  @SkipThrottle()
  @Post("webhook")
  @UseGuards(MetaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive WhatsApp Business API webhook events" })
  @ApiResponse({ status: 200, description: "Webhook event received" })
  async handleWebhook(@Body() payload: any) {
    return this.whatsAppService.handleWebhookPayload(payload);
  }
}
