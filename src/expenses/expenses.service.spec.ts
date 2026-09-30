import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { ExpensesService } from "./expenses.service";

describe("ExpensesService", () => {
  let service: ExpensesService;
  let prisma: any;
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      supplier: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "sup-1") return Promise.resolve({ id: "sup-1", name: "Supplier 1" });
          return Promise.resolve(null);
        }),
      },
      operationalExpense: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "exp-1", ...data })),
        findMany: jest.fn().mockResolvedValue([{ id: "exp-1", title: "Rent", amount: 1000 }]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "exp-1") return Promise.resolve({ id: "exp-1", title: "Rent", amount: 1000 });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        delete: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: { toNumber: () => 5000 } },
          _count: { _all: 5 },
        }),
      },
    };

    auditLogService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it("creates an expense", async () => {
    const res = await service.create({
      title: "Rent",
      category: "Utilities",
      amount: 1000,
      date: "2026-09-01T00:00:00.000Z",
    }, "admin-1");

    expect(res.title).toBe("Rent");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expense.create", entityType: "OperationalExpense" }),
    );
  });

  it("calculates monthly total", async () => {
    const total = await service.getMonthlyTotal(2026, 9);
    expect(total.totalAmount).toBe(5000);
    expect(total.totalExpensesCount).toBe(5);
  });
});
