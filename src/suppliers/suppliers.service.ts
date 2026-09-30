import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { buildPaginationMeta, resolvePagination } from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateSupplierDto, actorUserId?: string) {
    const supplier = await this.prisma.supplier.create({
      data: dto,
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "supplier.create",
      entityType: "Supplier",
      entityId: supplier.id,
      changes: dto,
    });

    return supplier;
  }

  async findAll(query: ListSuppliersQueryDto) {
    const { page, limit, skip, take } = resolvePagination(query);
    const { search } = query;

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(search?.trim()
        ? {
            OR: [
              { name: { contains: search.trim(), mode: "insensitive" } },
              { contactName: { contains: search.trim(), mode: "insensitive" } },
              { email: { contains: search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, actorUserId?: string) {
    await this.findOne(id);

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "supplier.update",
      entityType: "Supplier",
      entityId: id,
      changes: dto,
    });

    return updated;
  }

  async softDelete(id: string, actorUserId?: string) {
    await this.findOne(id);

    const deleted = await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "supplier.delete",
      entityType: "Supplier",
      entityId: id,
      changes: { softDeleted: true },
    });

    return deleted;
  }
}
