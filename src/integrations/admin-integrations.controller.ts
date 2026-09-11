import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TestGoogleSheetsDto } from "./dto/test-google-sheets.dto";
import { GoogleSheetsService } from "./google-sheets.service";

@ApiTags("admin integrations")
@Controller(["api/admin/integrations", "api/v1/admin/integrations"])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminIntegrationsController {
  constructor(private readonly googleSheetsService: GoogleSheetsService) {}

  @Post("google-sheets/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a test row to Google Sheets via Service Account (Admin)" })
  @ApiResponse({ status: 200, description: "Test row appended successfully." })
  @ApiResponse({ status: 400, description: "Credentials missing or Google Sheets API error." })
  async testGoogleSheets(@Body() dto: TestGoogleSheetsDto) {
    return this.googleSheetsService.sendTestRow(dto.rowData);
  }
}
