import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        category: true,
        images: {
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product "${slug}" was not found`);
    }

    return product;
  }

  async create(dto: CreateProductDto) {
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
      include: {
        category: true,
        images: true,
        variants: true,
      },
    });

    return product;
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    try {
      return await this.prisma.product.update({ where: { id }, data, include: { category: true, images: true, variants: true } });
    } catch {
      throw new NotFoundException(`Product ${id} was not found`);
    }
  }

  async archive(id: string) {
    return this.update(id, { status: ProductStatus.ARCHIVED });
  }
}
