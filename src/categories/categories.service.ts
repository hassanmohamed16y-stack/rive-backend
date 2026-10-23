import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { CreateCategoryDto } from "./dto/create-category.dto";

/** FK violation from a Prisma query (P2003) or from raw SQL (P2010 / 23503). */
function isForeignKeyViolation(error: unknown): boolean {
  if (isPrismaErrorCode(error, "P2003")) return true;
  const meta = (error as { meta?: { code?: string } } | null)?.meta;
  return isPrismaErrorCode(error, "P2010") && meta?.code === "23503";
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(
    filters?: { isFeatured?: string },
    pagination?: PaginationInput,
  ) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: Prisma.CategoryWhereInput =
      filters?.isFeatured === undefined
        ? {}
        : { isFeatured: filters.isFeatured === "true" };
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { createdAt: "desc" },
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
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          `A category with name "${dto.name}" or slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: "category.create",
      entityType: "Category",
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

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
    actorUserId?: string,
  ) {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...data,
          ...(actorUserId
            ? { updatedBy: { connect: { id: actorUserId } } }
            : {}),
        },
      });
      await this.auditLogService.record({
        userId: actorUserId,
        action: "category.update",
        entityType: "Category",
        entityId: category.id,
        changes: data,
      });
      return category;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025"))
        throw new NotFoundException(`Category ${id} was not found`);
      if (isPrismaErrorCode(error, "P2002"))
        throw new ConflictException(
          "A category with this name or slug already exists",
        );
      throw error;
    }
  }

  /**
   * Deletes a category.
   * - With `moveToId`: all of its products (also hidden ones) are moved there first.
   * - Without it: the category must have no live products. Products that were
   *   already deleted (hidden) are purged with it, unless they have order
   *   history, in which case the category stays and a conflict is returned.
   */
  async remove(id: string, actorUserId?: string, moveToId?: string) {
    if (moveToId && moveToId === id) {
      throw new BadRequestException(
        "Choose a different category to move the products to",
      );
    }

    try {
      const { category, moved } = await this.prisma.$transaction(async (tx) => {
        let moved = 0;

        if (moveToId) {
          const target = await tx.category.findUnique({
            where: { id: moveToId },
            select: { id: true },
          });
          if (!target) {
            throw new NotFoundException(`Category ${moveToId} was not found`);
          }
          const result = await tx.product.updateMany({
            where: { categoryId: id },
            data: { categoryId: moveToId },
          });
          moved = result.count;
        } else {
          const live = await tx.product.count({
            where: { categoryId: id, deletedAt: null },
          });
          if (live > 0) {
            throw new ConflictException(
              "Cannot delete a category that has products",
            );
          }
          // Raw SQL on purpose: the Prisma soft-delete middleware turns
          // product.deleteMany into another soft delete, which would leave
          // the rows (and the foreign key) in place.
          await tx.$executeRaw`DELETE FROM "Product" WHERE "categoryId" = ${id} AND "deletedAt" IS NOT NULL`;
        }

        const category = await tx.category.delete({ where: { id } });
        return { category, moved };
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "category.delete",
        entityType: "Category",
        entityId: category.id,
        changes: {
          deleted: true,
          movedProducts: moved,
          ...(moveToId ? { moveToCategoryId: moveToId } : {}),
        },
      });
      return category;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          "Cannot delete a category that has products",
        );
      }
      if (isPrismaErrorCode(error, "P2025"))
        throw new NotFoundException(`Category ${id} was not found`);
      throw error;
    }
  }
}
