import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { buildPaginationMeta, resolvePagination } from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpensesQueryDto } from "./dto/list-expenses-query.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateExpenseDto, actorUserId?: string) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, deletedAt: null },
      });
      if (!supplier) {
        throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
      }
    }

    const expense = await this.prisma.operationalExpense.create({
      data: {
        title: dto.title,
        category: dto.category,
        amount: dto.amount,
        date: new Date(dto.date),
        notes: dto.notes,
        supplierId: dto.supplierId,
      },
      include: { supplier: true },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "expense.create",
      entityType: "OperationalExpense",
      entityId: expense.id,
      changes: dto,
    });

    return expense;
  }

  async findAll(query: ListExpensesQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query);
    const { category, supplierId, startDate, endDate } = query;

    const where: Prisma.OperationalExpenseWhereInput = {};

    if (category?.trim()) {
      where.category = { equals: category.trim(), mode: "insensitive" };
    }

    if (supplierId?.trim()) {
      where.supplierId = supplierId.trim();
    }

    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.operationalExpense.findMany({
        where,
        include: { supplier: true },
        orderBy: { date: "desc" },
        skip,
        take,
      }),
      this.prisma.operationalExpense.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const expense = await this.prisma.operationalExpense.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto, actorUserId?: string) {
    await this.findOne(id);

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, deletedAt: null },
      });
      if (!supplier) {
        throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
      }
    }

    const updated = await this.prisma.operationalExpense.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { supplier: true },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "expense.update",
      entityType: "OperationalExpense",
      entityId: id,
      changes: dto,
    });

    return updated;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);

    const deleted = await this.prisma.operationalExpense.delete({
      where: { id },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "expense.delete",
      entityType: "OperationalExpense",
      entityId: id,
      changes: { deleted: true },
    });

    return deleted;
  }

  async getMonthlyTotal(year?: number, month?: number) {
    const targetYear = year ?? new Date().getFullYear();
    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = new Date(targetYear, month - 1, 1);
      endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    const aggregate = await this.prisma.operationalExpense.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    const totalAmount = aggregate._sum.amount ? aggregate._sum.amount.toNumber() : 0;

    return {
      year: targetYear,
      month: month ?? null,
      totalAmount,
      totalExpensesCount: aggregate._count._all,
    };
  }
}
