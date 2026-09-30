import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { SuppliersService } from "./suppliers.service";

describe("SuppliersService", () => {
  let service: SuppliersService;
  let prisma: any;
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      supplier: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "sup-1", ...data })),
        findMany: jest.fn().mockResolvedValue([{ id: "sup-1", name: "Supplier 1" }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "sup-1") return Promise.resolve({ id: "sup-1", name: "Supplier 1" });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };

    auditLogService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it("creates a supplier", async () => {
    const res = await service.create({ name: "Cotton Factory" }, "admin-1");
    expect(res.name).toBe("Cotton Factory");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "supplier.create", entityType: "Supplier" }),
    );
  });

  it("lists suppliers with pagination", async () => {
    const res = await service.findAll({ search: "Supplier", page: 1, limit: 10 });
    expect(res.data.length).toBe(1);
    expect(res.meta.total).toBe(1);
  });

  it("updates and soft-deletes supplier", async () => {
    const updated = await service.update("sup-1", { name: "Updated Name" }, "admin-1");
    expect(updated.name).toBe("Updated Name");

    const deleted = await service.softDelete("sup-1", "admin-1");
    expect(deleted.deletedAt).toBeDefined();
  });
});
