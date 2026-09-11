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

  @Post("google-sheets/export/orders")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export orders to Google Sheets" })
  async exportOrders() {
    return this.googleSheetsService.exportOrders();
  }

  @Post("google-sheets/export/customers")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export customers to Google Sheets" })
  async exportCustomers() {
    return this.googleSheetsService.exportCustomers();
  }

  @Post("google-sheets/export/products")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export products to Google Sheets" })
  async exportProducts() {
    return this.googleSheetsService.exportProducts();
  }

  @Post("google-sheets/export/inventory")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export inventory to Google Sheets" })
  async exportInventory() {
    return this.googleSheetsService.exportInventory();
  }

  @Post("google-sheets/export/sales-report")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Export sales report to Google Sheets" })
  async exportSalesReport() {
    return this.googleSheetsService.exportSalesReport();
  }
}
