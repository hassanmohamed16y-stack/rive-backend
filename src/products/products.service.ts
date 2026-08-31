import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, Size } from '@prisma/client';
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
    },
    pagination?: {
      skip?: number;
      take?: number;
    },
  ) {
    const where: Prisma.ProductWhereInput = {};

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

    return this.prisma.product.findMany({
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
      skip: pagination?.skip || 0,
      take: pagination?.take || undefined,
    });
  }

  async findOneBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
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
}
