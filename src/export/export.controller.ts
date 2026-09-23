import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ExportCustomersQueryDto } from "./dto/export-customers-query.dto";
import { ExportOrdersQueryDto } from "./dto/export-orders-query.dto";
import { ExportPaymentsQueryDto } from "./dto/export-payments-query.dto";
import { ExportService } from "./export.service";

@ApiTags("admin export")
@Controller(["api/admin/orders", "api/v1/admin/orders", "orders", "api/v1/orders"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class OrdersExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("export")
  @RequirePermission("orders.view")
  @ApiOperation({ summary: "Export orders in CSV or PDF format (Admin)" })
  @ApiResponse({ status: 200, description: "Export file generated successfully." })
  @ApiResponse({ status: 400, description: "Invalid format or date parameters." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async exportOrders(
    @Query() query: ExportOrdersQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.exportService.exportOrders(
      query,
      req.user!.id,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

@ApiTags("admin export")
@Controller(["api/admin/customers", "api/v1/admin/customers", "customers", "api/v1/customers"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class CustomersExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("export")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Export customers in CSV format (Admin)" })
  @ApiResponse({ status: 200, description: "Export file generated successfully." })
  @ApiResponse({ status: 400, description: "Invalid format or date parameters." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async exportCustomers(
    @Query() query: ExportCustomersQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.exportService.exportCustomers(
      query,
      req.user!.id,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

@ApiTags("admin export")
@Controller(["api/admin/payments", "api/v1/admin/payments", "payments", "api/v1/payments"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class PaymentsExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("export")
  @RequirePermission("orders.view")
  @ApiOperation({ summary: "Export payments in CSV or PDF format (Admin)" })
  @ApiResponse({ status: 200, description: "Export file generated successfully." })
  @ApiResponse({ status: 400, description: "Invalid format or date parameters." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async exportPayments(
    @Query() query: ExportPaymentsQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.exportService.exportPayments(
      query,
      req.user!.id,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
