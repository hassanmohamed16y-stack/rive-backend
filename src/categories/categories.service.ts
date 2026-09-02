import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(filters?: { isFeatured?: string }, pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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

    const category = await this.prisma.category.create({ data });
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
      if ((error as { code?: string } | null)?.code === 'P2025') throw new NotFoundException(`Category ${id} was not found`);
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
      if ((error as { code?: string } | null)?.code === 'P2003') {
        throw new ConflictException('Cannot delete a category that has products');
      }
      if ((error as { code?: string } | null)?.code === 'P2025') throw new NotFoundException(`Category ${id} was not found`);
      throw error;
    }
  }
}
