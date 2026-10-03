import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { MetaService } from "./meta.service";
import { MetaSignatureGuard } from "../common/guards/meta-signature.guard";

@ApiTags("meta")
@Controller("api/v1/integrations/meta")
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @SkipThrottle()
  @Get("webhook")
  @ApiOperation({ summary: "Verify Meta (Facebook/Instagram) webhook challenge" })
  verifyWebhook(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.metaService.verifyWebhookChallenge(mode, token, challenge);
  }

  @SkipThrottle()
  @Post("webhook")
  @UseGuards(MetaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Meta (Facebook/Instagram) webhook events" })
  @ApiResponse({ status: 200, description: "Webhook event received" })
  async handleWebhook(@Body() payload: any) {
    return this.metaService.handleWebhookPayload(payload);
  }
}
