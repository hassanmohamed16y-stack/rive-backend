import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCategoryDto) {
    const data: Prisma.CategoryCreateInput = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      isFeatured: dto.isFeatured ?? false,
    };

    return this.prisma.category.create({ data });
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
}
