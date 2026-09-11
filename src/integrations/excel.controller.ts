import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ExcelService } from "./excel.service";

@ApiTags("admin excel")
@Controller("api/v1/admin/excel")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Get("export/products")
  @ApiOperation({ summary: "Export products and variants as Excel file (.xlsx)" })
  async exportProducts(@Res() res: Response) {
    const buffer = await this.excelService.exportProducts();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="rive-products.xlsx"',
    );
    res.send(buffer);
  }

  @Get("export/orders")
  @ApiOperation({ summary: "Export orders as Excel file (.xlsx)" })
  async exportOrders(@Res() res: Response) {
    const buffer = await this.excelService.exportOrders();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="rive-orders.xlsx"',
    );
    res.send(buffer);
  }

  @Get("export/customers")
  @ApiOperation({ summary: "Export customers as Excel file (.xlsx)" })
  async exportCustomers(@Res() res: Response) {
    const buffer = await this.excelService.exportCustomers();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="rive-customers.xlsx"',
    );
    res.send(buffer);
  }

  @Post("import/products")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Import products and variants from Excel file (.xlsx)" })
  @ApiResponse({ status: 200, description: "Products imported successfully." })
  async importProducts(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Excel file is required in 'file' field");
    }
    return this.excelService.importProducts(file.buffer, req.user!.id);
  }

  @Post("import/inventory")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Import inventory stock counts from Excel file (.xlsx)" })
  @ApiResponse({ status: 200, description: "Inventory updated successfully." })
  async importInventory(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Excel file is required in 'file' field");
    }
    return this.excelService.importInventory(file.buffer, req.user!.id);
  }
}
