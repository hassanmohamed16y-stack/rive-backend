import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminDashboardService } from "./admin-dashboard.service";

@ApiTags("admin dashboard")
@Controller("api/v1/admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get top-level dashboard metrics (Admin)" })
  async getOverview() {
    return this.dashboardService.getOverviewStats();
  }

  @Get("recent-orders")
  @ApiOperation({ summary: "Get recent orders for dashboard" })
  async getRecentOrders(@Query("limit") limit?: number) {
    return this.dashboardService.getRecentOrders(limit ? Number(limit) : 5);
  }

  @Get("recent-customers")
  @ApiOperation({ summary: "Get recent registered customers" })
  async getRecentCustomers(@Query("limit") limit?: number) {
    return this.dashboardService.getRecentCustomers(limit ? Number(limit) : 5);
  }

  @Get("low-stock")
  @ApiOperation({ summary: "Get low stock variants" })
  async getLowStock(@Query("threshold") threshold?: number) {
    return this.dashboardService.getLowStockProducts(threshold ? Number(threshold) : 5);
  }

  @Get("order-status-stats")
  @ApiOperation({ summary: "Get order status distribution" })
  async getOrderStatusStats() {
    return this.dashboardService.getOrderStatusStatistics();
  }

  @Get("payment-status-stats")
  @ApiOperation({ summary: "Get payment status distribution" })
  async getPaymentStatusStats() {
    return this.dashboardService.getPaymentStatusStatistics();
  }

  @Get("top-products")
  @ApiOperation({ summary: "Get top selling products" })
  async getTopProducts(@Query("limit") limit?: number) {
    return this.dashboardService.getTopProducts(limit ? Number(limit) : 5);
  }

  @Get("sales-report")
  @ApiOperation({ summary: "Get consolidated sales report" })
  async getSalesReport() {
    return this.dashboardService.getSalesReport();
  }
}
