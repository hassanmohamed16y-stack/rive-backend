import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get credentials() {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || process.env.GOOGLE_SERVICE_ACCOUNT?.trim();
    const sheetId = process.env.GOOGLE_SHEET_ID?.trim();

    if (!jsonStr || !sheetId) {
      return { isConfigured: false, sheetId: undefined, credentials: undefined };
    }

    try {
      const credentials = JSON.parse(jsonStr);
      return { isConfigured: true, sheetId, credentials };
    } catch {
      this.logger.warn("GOOGLE_SERVICE_ACCOUNT is not valid JSON.");
      return { isConfigured: false, sheetId: undefined, credentials: undefined };
    }
  }

  async appendRows(tabName: string, rows: string[][]): Promise<{ success: boolean; rowsExported: number }> {
    const { isConfigured, sheetId, credentials } = this.credentials;

    if (!isConfigured || !sheetId || !credentials) {
      this.logger.warn("Google Sheets API credentials missing.");
      throw new BadRequestException(
        "Google Sheets API credentials are not configured. Please set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID.",
      );
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${tabName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });

      return { success: true, rowsExported: rows.length };
    } catch (error) {
      this.logger.error(`Failed to export rows to tab ${tabName}`, error);
      throw new BadRequestException("Google Sheets API export failed");
    }
  }

  async appendRow(values: string[]): Promise<{ success: boolean; updatedRange?: string }> {
    const res = await this.appendRows("Sheet1", [values]);
    return { success: res.success, updatedRange: "Sheet1!A1" };
  }

  async sendTestRow(customRowData?: string[]) {
    const { isConfigured } = this.credentials;

    if (!isConfigured) {
      this.logger.warn("Google Sheets test requested but credentials are not configured.");
      throw new BadRequestException(
        "Google Sheets API credentials are not configured. Please set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID.",
      );
    }

    const rowValues = customRowData && customRowData.length > 0
      ? customRowData
      : [new Date().toISOString(), "Test Integration Entry", "RIVÉ Backend", "STATUS_OK"];

    return this.appendRow(rowValues);
  }

  async exportOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const header = ["Order Number", "Status", "Payment Status", "Total Amount", "Customer Email", "Created At"];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.status,
      o.paymentStatus,
      o.totalAmount.toString(),
      o.customerEmail ?? "",
      o.createdAt.toISOString(),
    ]);
    return this.appendRows("Orders", [header, ...rows]);
  }

  async exportCustomers() {
    const customers = await this.prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
    });
    const header = ["ID", "Full Name", "Email", "Verified", "Created At"];
    const rows = customers.map((c) => [
      c.id,
      c.fullName,
      c.email,
      c.emailVerifiedAt ? "Yes" : "No",
      c.createdAt.toISOString(),
    ]);
    return this.appendRows("Customers", [header, ...rows]);
  }

  async exportProducts() {
    const products = await this.prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    const header = ["ID", "Name", "Slug", "Category", "Price", "Compare Price", "Status"];
    const rows = products.map((p) => [
      p.id,
      p.name,
      p.slug,
      p.category?.name ?? "",
      p.price.toString(),
      p.compareAtPrice ? p.compareAtPrice.toString() : "",
      p.status,
    ]);
    return this.appendRows("Products", [header, ...rows]);
  }

  async exportInventory() {
    const variants = await this.prisma.productVariant.findMany({
      include: { product: true },
      orderBy: { stock: "asc" },
    });
    const header = ["SKU", "Product Name", "Size", "Color", "Stock", "Available"];
    const rows = variants.map((v) => [
      v.sku,
      v.product.name,
      v.size ?? "",
      v.colorHex ?? "",
      v.stock.toString(),
      v.isAvailable ? "Yes" : "No",
    ]);
    return this.appendRows("Inventory", [header, ...rows]);
  }

  async exportSalesReport() {
    const totalOrders = await this.prisma.order.count();
    const paidOrders = await this.prisma.order.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { totalAmount: true },
      _count: true,
    });
    const header = ["Report Date", "Total Orders", "Paid Orders", "Total Revenue (EGP)"];
    const rows = [[
      new Date().toISOString(),
      totalOrders.toString(),
      paidOrders._count.toString(),
      (paidOrders._sum.totalAmount ?? 0).toString(),
    ]];
    return this.appendRows("SalesReports", [header, ...rows]);
  }
}
