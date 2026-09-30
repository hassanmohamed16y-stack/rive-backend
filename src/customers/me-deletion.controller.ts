import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CustomersService } from "./customers.service";
import { CreateDeletionRequestDto } from "./dto/create-deletion-request.dto";

@ApiTags("me")
@Controller(["api/me", "api/v1/me"])
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeDeletionController {
  constructor(private readonly customersService: CustomersService) {}

  @Post("deletion-request")
  @ApiOperation({ summary: "Submit data deletion request (Customer)" })
  @ApiResponse({ status: 201, description: "Deletion request submitted successfully." })
  async createDeletionRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    return this.customersService.createDeletionRequest(req.user!.id, dto);
  }
}
