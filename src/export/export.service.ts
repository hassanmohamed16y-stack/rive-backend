import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { generateCsvReport } from "./csv-generator.util";
import { ExportCustomersQueryDto } from "./dto/export-customers-query.dto";
import { ExportOrdersQueryDto } from "./dto/export-orders-query.dto";
import { ExportPaymentsQueryDto } from "./dto/export-payments-query.dto";
import { generatePdfReport } from "./pdf-generator.util";

export const MAX_EXPORT_ROWS = 5000;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async exportOrders(query: ExportOrdersQueryDto, actorUserId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const format = (query.format ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "pdf") {
      throw new BadRequestException("Format must be 'csv' or 'pdf'");
    }

    const where: Prisma.OrderWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const startDateStr = query.startDate ?? query.from;
    const endDateStr = query.endDate ?? query.to;

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) throw new BadRequestException("Invalid startDate/from parameter");
        where.createdAt.gte = start;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (isNaN(end.getTime())) throw new BadRequestException("Invalid endDate/to parameter");
        where.createdAt.lte = end;
      }
    }

    const totalCount = await this.prisma.order.count({ where });
    if (totalCount > MAX_EXPORT_ROWS) {
      this.logger.warn(`Orders export exceeded ${MAX_EXPORT_ROWS} rows limit (${totalCount} matched). Truncating output to ${MAX_EXPORT_ROWS}.`);
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });

    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (format === "csv") {
      filename = `orders-export-${Date.now()}.csv`;
      mimeType = "text/csv";
      const columns = [
        { header: "Order Number", key: "orderNumber", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Payment Status", key: "paymentStatus", width: 15 },
        { header: "Customer Name", key: "customerName", width: 20 },
        { header: "Customer Email", key: "customerEmail", width: 25 },
        { header: "Subtotal", key: "subtotal", width: 12 },
        { header: "Discount", key: "discount", width: 12 },
        { header: "Shipping Fee", key: "shippingFee", width: 12 },
        { header: "Total Amount", key: "totalAmount", width: 15 },
        { header: "Items Count", key: "itemsCount", width: 12 },
        { header: "Created At", key: "createdAt", width: 22 },
      ];

      const rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        customerName: o.customerName ?? "",
        customerEmail: o.customerEmail ?? "",
        subtotal: o.subtotal.toString(),
        discount: o.discount.toString(),
        shippingFee: o.shippingFee.toString(),
        totalAmount: o.totalAmount.toString(),
        itemsCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      }));

      buffer = await generateCsvReport("Orders", columns, rows);
    } else {
      filename = `orders-export-${Date.now()}.pdf`;
      mimeType = "application/pdf";
      const headers = [
        "Order #",
        "Status",
        "Payment",
        "Customer Name",
        "Email",
        "Total",
        "Items",
        "Created At",
      ];
      const rows = orders.map((o) => [
        o.orderNumber,
        o.status,
        o.paymentStatus,
        o.customerName ?? "N/A",
        o.customerEmail ?? "N/A",
        `${o.totalAmount.toString()} EGP`,
        o.items.length,
        o.createdAt.toISOString().slice(0, 10),
      ]);

      buffer = await generatePdfReport({
        title: "Orders Export Report",
        headers,
        rows,
        footerText: totalCount > MAX_EXPORT_ROWS ? `Showing top ${MAX_EXPORT_ROWS} of ${totalCount} records` : undefined,
      });
    }

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "export.orders",
        entityType: "Order",
        entityId: "export",
        changes: {
          format,
          count: orders.length,
          totalMatched: totalCount,
          truncated: totalCount > MAX_EXPORT_ROWS,
          filters: { status: query.status, startDate: startDateStr, endDate: endDateStr },
        },
      });
    }

    return { buffer, filename, mimeType };
  }

  async exportCustomers(query: ExportCustomersQueryDto, actorUserId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const format = (query.format ?? "csv").toLowerCase();
    if (format !== "csv") {
      throw new BadRequestException("Format for customers export must be 'csv'");
    }

    const where: Prisma.UserWhereInput = { role: UserRole.CUSTOMER };

    const startDateStr = query.startDate ?? query.from;
    const endDateStr = query.endDate ?? query.to;

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) throw new BadRequestException("Invalid startDate/from parameter");
        where.createdAt.gte = start;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (isNaN(end.getTime())) throw new BadRequestException("Invalid endDate/to parameter");
        where.createdAt.lte = end;
      }
    }

    const totalCount = await this.prisma.user.count({ where });
    if (totalCount > MAX_EXPORT_ROWS) {
      this.logger.warn(`Customers export exceeded ${MAX_EXPORT_ROWS} rows limit (${totalCount} matched). Truncating output to ${MAX_EXPORT_ROWS}.`);
    }

    const customers = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });

    const filename = `customers-export-${Date.now()}.csv`;
    const mimeType = "text/csv";

    const columns = [
      { header: "ID", key: "id", width: 25 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Verified At", key: "verifiedAt", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];

    const rows = customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      verifiedAt: c.emailVerifiedAt ? c.emailVerifiedAt.toISOString() : "Unverified",
      createdAt: c.createdAt.toISOString(),
    }));

    const buffer = await generateCsvReport("Customers", columns, rows);

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "export.customers",
        entityType: "User",
        entityId: "export",
        changes: {
          format: "csv",
          count: customers.length,
          totalMatched: totalCount,
          truncated: totalCount > MAX_EXPORT_ROWS,
          filters: { startDate: startDateStr, endDate: endDateStr },
        },
      });
    }

    return { buffer, filename, mimeType };
  }

  async exportPayments(query: ExportPaymentsQueryDto, actorUserId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const format = (query.format ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "pdf") {
      throw new BadRequestException("Format must be 'csv' or 'pdf'");
    }

    const where: Prisma.OrderWhereInput = {};
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    const startDateStr = query.startDate ?? query.from;
    const endDateStr = query.endDate ?? query.to;

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) throw new BadRequestException("Invalid startDate/from parameter");
        where.createdAt.gte = start;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (isNaN(end.getTime())) throw new BadRequestException("Invalid endDate/to parameter");
        where.createdAt.lte = end;
      }
    }

    const totalCount = await this.prisma.order.count({ where });
    if (totalCount > MAX_EXPORT_ROWS) {
      this.logger.warn(`Payments export exceeded ${MAX_EXPORT_ROWS} rows limit (${totalCount} matched). Truncating output to ${MAX_EXPORT_ROWS}.`);
    }

    const payments = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });

    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (format === "csv") {
      filename = `payments-export-${Date.now()}.csv`;
      mimeType = "text/csv";

      const columns = [
        { header: "Order Number", key: "orderNumber", width: 20 },
        { header: "Customer Name", key: "customerName", width: 20 },
        { header: "Customer Email", key: "customerEmail", width: 25 },
        { header: "Payment Status", key: "paymentStatus", width: 15 },
        { header: "Total Amount", key: "totalAmount", width: 15 },
        { header: "Payment Ref ID", key: "paymentRefId", width: 25 },
        { header: "Created At", key: "createdAt", width: 22 },
      ];

      const rows = payments.map((p) => ({
        orderNumber: p.orderNumber,
        customerName: p.customerName ?? "",
        customerEmail: p.customerEmail ?? "",
        paymentStatus: p.paymentStatus,
        totalAmount: p.totalAmount.toString(),
        paymentRefId: p.paymobTransactionId || p.paymobIntentionId || p.paymentSessionId || "N/A",
        createdAt: p.createdAt.toISOString(),
      }));

      buffer = await generateCsvReport("Payments", columns, rows);
    } else {
      filename = `payments-export-${Date.now()}.pdf`;
      mimeType = "application/pdf";

      const headers = [
        "Order #",
        "Customer Name",
        "Email",
        "Payment Status",
        "Total Amount",
        "Payment Ref ID",
        "Created At",
      ];

      const rows = payments.map((p) => [
        p.orderNumber,
        p.customerName ?? "N/A",
        p.customerEmail ?? "N/A",
        p.paymentStatus,
        `${p.totalAmount.toString()} EGP`,
        p.paymobTransactionId || p.paymobIntentionId || p.paymentSessionId || "N/A",
        p.createdAt.toISOString().slice(0, 10),
      ]);

      buffer = await generatePdfReport({
        title: "Payments Export Report",
        headers,
        rows,
        footerText: totalCount > MAX_EXPORT_ROWS ? `Showing top ${MAX_EXPORT_ROWS} of ${totalCount} records` : undefined,
      });
    }

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "export.payments",
        entityType: "Payment",
        entityId: "export",
        changes: {
          format,
          count: payments.length,
          totalMatched: totalCount,
          truncated: totalCount > MAX_EXPORT_ROWS,
          filters: { paymentStatus: query.paymentStatus, startDate: startDateStr, endDate: endDateStr },
        },
      });
    }

    return { buffer, filename, mimeType };
  }
}
