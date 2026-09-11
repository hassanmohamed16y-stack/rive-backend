import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async exportProducts(): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Products");

    sheet.columns = [
      { header: "Product Name", key: "name", width: 25 },
      { header: "Slug", key: "slug", width: 20 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 12 },
      { header: "Compare Price", key: "compareAtPrice", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "SKU", key: "sku", width: 15 },
      { header: "Size", key: "size", width: 10 },
      { header: "Stock", key: "stock", width: 10 },
    ];

    for (const p of products) {
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          sheet.addRow({
            name: p.name,
            slug: p.slug,
            category: p.category?.name ?? "",
            price: p.price.toString(),
            compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toString() : "",
            status: p.status,
            sku: v.sku,
            size: v.size,
            stock: v.stock,
          });
        }
      } else {
        sheet.addRow({
          name: p.name,
          slug: p.slug,
          category: p.category?.name ?? "",
          price: p.price.toString(),
          compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toString() : "",
          status: p.status,
          sku: "N/A",
          size: "N/A",
          stock: 0,
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportOrders(): Promise<Buffer> {
    const orders = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Orders");

    sheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Payment Status", key: "paymentStatus", width: 15 },
      { header: "Customer Name", key: "customerName", width: 20 },
      { header: "Customer Email", key: "customerEmail", width: 25 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    for (const o of orders) {
      sheet.addRow({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        customerName: o.customerName ?? "",
        customerEmail: o.customerEmail ?? "",
        totalAmount: o.totalAmount.toString(),
        createdAt: o.createdAt.toISOString(),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportCustomers(): Promise<Buffer> {
    const customers = await this.prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");

    sheet.columns = [
      { header: "ID", key: "id", width: 25 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Verified At", key: "verifiedAt", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    for (const c of customers) {
      sheet.addRow({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        verifiedAt: c.emailVerifiedAt ? c.emailVerifiedAt.toISOString() : "Unverified",
        createdAt: c.createdAt.toISOString(),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importProducts(fileBuffer: Buffer, actorUserId?: string) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new BadRequestException("Invalid or corrupted Excel file format");
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("Excel file contains no worksheets");
    }

    const rowsToImport: Array<{
      name: string;
      slug: string;
      categoryName: string;
      price: number;
      sku: string;
      size: string;
      stock: number;
    }> = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header row
      const name = row.getCell(1).text?.trim();
      const slug = row.getCell(2).text?.trim().toLowerCase();
      const categoryName = row.getCell(3).text?.trim();
      const price = parseFloat(row.getCell(4).text);
      const sku = row.getCell(7).text?.trim();
      const size = row.getCell(8).text?.trim().toUpperCase();
      const stock = parseInt(row.getCell(9).text, 10);

      if (!name || !slug || !categoryName || isNaN(price) || price < 0 || !sku) {
        throw new BadRequestException(
          `Row ${rowNumber} contains invalid or incomplete data. Import aborted.`,
        );
      }

      rowsToImport.push({
        name,
        slug,
        categoryName,
        price,
        sku,
        size: ["XS", "S", "M", "L", "XL"].includes(size) ? size : "M",
        stock: isNaN(stock) ? 0 : Math.max(0, stock),
      });
    });

    if (rowsToImport.length === 0) {
      throw new BadRequestException("Excel file contains no product rows to import");
    }

    let createdCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of rowsToImport) {
        let category = await tx.category.findFirst({
          where: {
            OR: [{ name: item.categoryName }, { slug: item.categoryName.toLowerCase() }],
          },
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              name: item.categoryName,
              slug: item.categoryName.toLowerCase().replace(/\s+/g, "-"),
            },
          });
        }

        let product = await tx.product.findUnique({
          where: { slug: item.slug },
        });

        if (!product) {
          product = await tx.product.create({
            data: {
              name: item.name,
              slug: item.slug,
              price: item.price,
              categoryId: category.id,
              status: "ACTIVE",
            },
          });
        }

        await tx.productVariant.upsert({
          where: { sku: item.sku },
          create: {
            productId: product.id,
            sku: item.sku,
            size: item.size as any,
            price: item.price,
            stock: item.stock,
          },
          update: {
            price: item.price,
            stock: item.stock,
          },
        });

        createdCount++;
      }
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "excel.import-products",
        entityType: "Product",
        entityId: "bulk",
        changes: { rowsImported: createdCount },
      });
    }

    return { success: true, rowsImported: createdCount };
  }

  async importInventory(fileBuffer: Buffer, actorUserId?: string) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new BadRequestException("Invalid or corrupted Excel file format");
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("Excel file contains no worksheets");
    }

    const updates: Array<{ sku: string; stock: number }> = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const sku = row.getCell(1).text?.trim();
      const stock = parseInt(row.getCell(2).text, 10);

      if (!sku || isNaN(stock) || stock < 0) {
        throw new BadRequestException(
          `Row ${rowNumber} contains invalid SKU or stock value. Import aborted.`,
        );
      }

      updates.push({ sku, stock });
    });

    if (updates.length === 0) {
      throw new BadRequestException("No inventory rows found to import");
    }

    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of updates) {
        const result = await tx.productVariant.updateMany({
          where: { sku: item.sku },
          data: { stock: item.stock },
        });

        if (result.count === 0) {
          throw new BadRequestException(
            `SKU '${item.sku}' not found in database. Import aborted.`,
          );
        }

        updatedCount += result.count;
      }
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "excel.import-inventory",
        entityType: "ProductVariant",
        entityId: "bulk",
        changes: { variantsUpdated: updatedCount },
      });
    }

    return { success: true, variantsUpdated: updatedCount };
  }
}
