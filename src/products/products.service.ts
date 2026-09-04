import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, PaginationInput, resolvePagination } from '../common/utils/pagination';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

const productInclude = {
  category: true,
  images: {
    orderBy: { createdAt: 'asc' as const },
  },
  variants: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(
    filters?: {
      category?: string;
      isFeatured?: string;
      search?: string;
      status?: ProductStatus;
    },
    pagination?: PaginationInput,
    includeAllStatuses = false,
  ) {
    const where: Prisma.ProductWhereInput = includeAllStatuses
      ? { ...(filters?.status ? { status: filters.status } : {}) }
      : { status: ProductStatus.ACTIVE };

    if (filters?.category) {
      where.category = {
        slug: filters.category,
      };
    }

    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured === 'true';
    }

    if (filters?.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { shortDescription: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const { page, limit, skip, take } = resolvePagination(pagination);
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          images: {
            orderBy: { createdAt: 'asc' },
            where: { isPrimary: true },
          },
          variants: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOneBySlug(slug: string, includeAllStatuses = false) {
    const product = await this.prisma.product.findFirst({
      where: includeAllStatuses ? { slug } : { slug, status: ProductStatus.ACTIVE },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException(`Product "${slug}" was not found`);
    }

    return product;
  }

  async findByIdForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }

    return product;
  }

  async create(dto: CreateProductDto, actorUserId?: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug: dto.categorySlug },
    });

    if (!category) {
      throw new NotFoundException(`Category "${dto.categorySlug}" was not found`);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        shortDescription: dto.shortDescription,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? 'ACTIVE',
        category: {
          connect: { id: category.id },
        },
        ...(actorUserId
          ? {
              createdBy: { connect: { id: actorUserId } },
              updatedBy: { connect: { id: actorUserId } },
            }
          : {}),
        images: {
          create: dto.images.map((image) => ({
            url: image.url,
            altText: image.altText,
            isPrimary: image.isPrimary ?? false,
          })),
        },
        variants: {
          create: dto.variants.map((variant) => ({
            sku: variant.sku,
            colorHex: variant.colorHex ?? '#945958',
            size: variant.size,
            price: variant.price,
            stock: variant.stock ?? 0,
            isAvailable: variant.isAvailable ?? true,
          })),
        },
      },
      include: productInclude,
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      changes: dto,
    });

    return product;
  }

  async update(id: string, data: Prisma.ProductUpdateInput, actorUserId?: string) {
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...data,
          ...(actorUserId ? { updatedBy: { connect: { id: actorUserId } } } : {}),
        },
        include: productInclude,
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: 'product.update',
        entityType: 'Product',
        entityId: product.id,
        changes: data,
      });

      return product;
    } catch {
      throw new NotFoundException(`Product ${id} was not found`);
    }
  }

  async archive(id: string, actorUserId?: string) {
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          status: ProductStatus.ARCHIVED,
          ...(actorUserId ? { updatedBy: { connect: { id: actorUserId } } } : {}),
        },
        include: productInclude,
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: 'product.archive',
        entityType: 'Product',
        entityId: product.id,
        changes: { status: ProductStatus.ARCHIVED },
      });

      return product;
    } catch {
      throw new NotFoundException(`Product ${id} was not found`);
    }
  }

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }
  }

  async addVariant(productId: string, dto: CreateProductVariantDto, actorUserId?: string) {
    await this.assertProductExists(productId);

    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: dto.sku,
          colorHex: dto.colorHex ?? '#945958',
          size: dto.size,
          price: dto.price,
          stock: dto.stock ?? 0,
          isAvailable: dto.isAvailable ?? true,
        },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: 'product.variant.create',
        entityType: 'ProductVariant',
        entityId: variant.id,
        changes: dto,
      });

      return variant;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        throw new ConflictException(`A variant with SKU "${dto.sku}" already exists`);
      }
      throw error;
    }
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto, actorUserId?: string) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existing) {
      throw new NotFoundException(`Variant ${variantId} was not found for product ${productId}`);
    }

    const { expectedUpdatedAt, ...data } = dto;

    let updateCount: number;
    try {
      // Optimistic locking (TOCTOU guard): the update only applies if the row's updatedAt
      // still matches what the client last read. A concurrent admin update in between would
      // have changed updatedAt, causing this conditional update to affect zero rows.
      const result = await this.prisma.productVariant.updateMany({
        where: { id: variantId, productId, updatedAt: new Date(expectedUpdatedAt) },
        data,
      });
      updateCount = result.count;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        throw new ConflictException(`A variant with SKU "${data.sku}" already exists`);
      }
      throw error;
    }

    if (updateCount !== 1) {
      throw new ConflictException(
        'This variant was modified by another user in the meantime. Reload the data and try again.',
      );
    }

    const variant = await this.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'product.variant.update',
      entityType: 'ProductVariant',
      entityId: variant.id,
      changes: data,
    });

    return variant;
  }

  async removeVariant(productId: string, variantId: string, actorUserId?: string) {
    const existing = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existing) {
      throw new NotFoundException(`Variant ${variantId} was not found for product ${productId}`);
    }

    try {
      await this.prisma.productVariant.delete({ where: { id: variantId } });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2003') {
        throw new ConflictException('Cannot delete a variant that has existing order items');
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'product.variant.delete',
      entityType: 'ProductVariant',
      entityId: variantId,
      changes: { deleted: true },
    });

    return { success: true };
  }

  async addImage(productId: string, dto: CreateProductImageDto, actorUserId?: string) {
    await this.assertProductExists(productId);

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        url: dto.url,
        altText: dto.altText,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'product.image.create',
      entityType: 'ProductImage',
      entityId: image.id,
      changes: dto,
    });

    return image;
  }

  async removeImage(productId: string, imageId: string, actorUserId?: string) {
    const existing = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!existing) {
      throw new NotFoundException(`Image ${imageId} was not found for product ${productId}`);
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });

    await this.auditLogService.record({
      userId: actorUserId,
      action: 'product.image.delete',
      entityType: 'ProductImage',
      entityId: imageId,
      changes: { deleted: true },
    });

    return { success: true };
  }
}
