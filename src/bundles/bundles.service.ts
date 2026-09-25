import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBundleDto } from "./dto/create-bundle.dto";
import { UpdateBundleDto } from "./dto/update-bundle.dto";

@Injectable()
export class BundlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateBundleDto, actorUserId?: string) {
    const bundle = await this.prisma.bundle.create({
      data: {
        name: dto.name,
        productIds: dto.productIds as unknown as Prisma.InputJsonValue,
        bundlePrice: dto.bundlePrice,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "bundle.create",
      entityType: "Bundle",
      entityId: bundle.id,
      changes: dto,
    });

    return bundle;
  }

  async findAllPublic(pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where = { isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.bundle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.bundle.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findAllAdmin(pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const [data, total] = await Promise.all([
      this.prisma.bundle.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.bundle.count(),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const bundle = await this.prisma.bundle.findUnique({ where: { id } });
    if (!bundle) {
      throw new NotFoundException(`Bundle ${id} was not found`);
    }
    return bundle;
  }

  async update(id: string, dto: UpdateBundleDto, actorUserId?: string) {
    await this.findOne(id);

    const updated = await this.prisma.bundle.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.productIds
          ? { productIds: dto.productIds as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.bundlePrice !== undefined
          ? { bundlePrice: dto.bundlePrice }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "bundle.update",
      entityType: "Bundle",
      entityId: updated.id,
      changes: dto,
    });

    return updated;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);
    await this.prisma.bundle.delete({ where: { id } });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "bundle.delete",
      entityType: "Bundle",
      entityId: id,
      changes: { deleted: true },
    });

    return { success: true };
  }
}
