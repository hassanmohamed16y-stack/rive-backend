import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ValidateReferralDto } from "./dto/validate-referral.dto";
import { ReferralsService } from "./referrals.service";

@ApiTags("referrals")
@Controller("api/v1/referrals")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get("my-code")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get or generate my referral code" })
  async getMyCode(@Req() req: AuthenticatedRequest) {
    return this.referralsService.getMyCode(req.user!.id);
  }

  @Post("validate")
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Validate a referral code" })
  @ApiResponse({ status: 200, description: "Referral code is valid." })
  @ApiResponse({ status: 400, description: "Self-referral or invalid code." })
  async validate(
    @Body() dto: ValidateReferralDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.referralsService.validateCode(dto.code, req.user?.id);
  }
}
