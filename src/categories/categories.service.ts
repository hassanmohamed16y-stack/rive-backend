import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, PaginationInput, resolvePagination } from '../common/utils/pagination';
import { isPrismaErrorCode } from '../common/utils/prisma-error';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(filters?: { isFeatured?: string }, pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: Prisma.CategoryWhereInput = filters?.isFeatured === undefined
      ? {}
      : { isFeatured: filters.isFeatured === 'true' };
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.category.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async create(dto: CreateCategoryDto, actorUserId?: string) {
    const data: Prisma.CategoryCreateInput = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      isFeatured: dto.isFeatured ?? false,
      ...(actorUserId
        ? {
            createdBy: { connect: { id: actorUserId } },
            updatedBy: { connect: { id: actorUserId } },
          }
        : {}),
    };

    let category;
    try {
      category = await this.prisma.category.create({ data });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(`A category with name "${dto.name}" or slug "${dto.slug}" already exists`);
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'category.create',
      entityType: 'Category',
      entityId: category.id,
      changes: dto,
    });
    return category;
  }

  async findOneBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category "${slug}" was not found`);
    }

    return category;
  }

  async update(id: string, data: Prisma.CategoryUpdateInput, actorUserId?: string) {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...data,
          ...(actorUserId ? { updatedBy: { connect: { id: actorUserId } } } : {}),
        },
      });
      await this.auditLogService.record({
        userId: actorUserId,
        action: 'category.update',
        entityType: 'Category',
        entityId: category.id,
        changes: data,
      });
      return category;
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2025')) throw new NotFoundException(`Category ${id} was not found`);
      if (isPrismaErrorCode(error, 'P2002')) throw new ConflictException('A category with this name or slug already exists');
      throw error;
    }
  }

  async remove(id: string, actorUserId?: string) {
    try {
      const category = await this.prisma.category.delete({ where: { id } });
      await this.auditLogService.record({
        userId: actorUserId,
        action: 'category.delete',
        entityType: 'Category',
        entityId: category.id,
        changes: { deleted: true },
      });
      return category;
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2003')) {
        throw new ConflictException('Cannot delete a category that has products');
      }
      if (isPrismaErrorCode(error, 'P2025')) throw new NotFoundException(`Category ${id} was not found`);
      throw error;
    }
  }
}
