import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      }),
      this.prisma.category.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2025') throw new NotFoundException(`Category ${id} was not found`);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2003') {
        throw new ConflictException('Cannot delete a category that has products');
      }
      if ((error as { code?: string } | null)?.code === 'P2025') throw new NotFoundException(`Category ${id} was not found`);
      throw error;
    }
  }
}
