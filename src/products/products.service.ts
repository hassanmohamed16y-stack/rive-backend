import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
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
    pagination?: {
      page?: number;
      limit?: number;
    },
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

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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

  async createVariant(productId: string, dto: CreateProductVariantDto, actorUserId?: string) {
      await this.findByIdForAdmin(productId);
      const variant = await this.prisma.productVariant.create({ data: { productId, ...dto } });
      await this.auditLogService.record({ userId: actorUserId, action: 'product-variant.create', entityType: 'ProductVariant', entityId: variant.id, changes: dto });
      return variant;
    }

    async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto, actorUserId?: string) {
      const result = await this.prisma.productVariant.updateMany({ where: { id: variantId, productId }, data: dto });
      if (result.count !== 1) throw new NotFoundException(`Product variant ${variantId} was not found`);
      const variant = await this.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      await this.auditLogService.record({ userId: actorUserId, action: 'product-variant.update', entityType: 'ProductVariant', entityId: variant.id, changes: dto });
      return variant;
    }

    async removeVariant(productId: string, variantId: string, actorUserId?: string) {
      try {
        const existing = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
        if (!existing) throw new NotFoundException(`Product variant ${variantId} was not found`);
        const variant = await this.prisma.productVariant.delete({ where: { id: variantId } });
        await this.auditLogService.record({ userId: actorUserId, action: 'product-variant.delete', entityType: 'ProductVariant', entityId: variant.id, changes: { deleted: true } });
        return variant;
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2003') throw new ConflictException('Cannot delete a variant with order history; set isAvailable to false instead');
        if (error instanceof NotFoundException || (error as { code?: string })?.code === 'P2025') throw new NotFoundException(`Product variant ${variantId} was not found`);
        throw error;
      }
    }

    async createImage(productId: string, dto: CreateProductImageDto, actorUserId?: string) {
      await this.findByIdForAdmin(productId);
      const image = await this.prisma.productImage.create({ data: { productId, ...dto } });
      await this.auditLogService.record({ userId: actorUserId, action: 'product-image.create', entityType: 'ProductImage', entityId: image.id, changes: dto });
      return image;
    }

    async removeImage(productId: string, imageId: string, actorUserId?: string) {
      const result = await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
      if (result.count !== 1) throw new NotFoundException(`Product image ${imageId} was not found`);
      await this.auditLogService.record({ userId: actorUserId, action: 'product-image.delete', entityType: 'ProductImage', entityId: imageId, changes: { deleted: true } });
      return { id: imageId, deleted: true };
  }
}
