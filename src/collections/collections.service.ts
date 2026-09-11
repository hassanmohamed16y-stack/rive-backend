import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(
    filters: { search?: string; isFeatured?: boolean },
    pagination: PaginationInput,
  ) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: Prisma.CollectionWhereInput = {
      ...(filters.isFeatured !== undefined
        ? { isFeatured: filters.isFeatured }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        include: {
          products: {
            include: {
              product: {
                include: {
                  images: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.collection.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOneBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                variants: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${slug}' was not found`);
    }

    return collection;
  }

  async findById(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                variants: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection ID '${id}' was not found`);
    }

    return collection;
  }

  async create(dto: CreateCollectionDto, actorUserId?: string) {
    const existing = await this.prisma.collection.findFirst({
      where: {
        OR: [{ name: dto.name }, { slug: dto.slug }],
      },
    });

    if (existing) {
      throw new ConflictException(
        "A collection with this name or slug already exists",
      );
    }

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.toLowerCase().trim(),
        description: dto.description?.trim(),
        imageUrl: dto.imageUrl?.trim(),
        isFeatured: dto.isFeatured ?? false,
      },
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "collection.create",
        entityType: "Collection",
        entityId: collection.id,
        changes: { name: collection.name, slug: collection.slug },
      });
    }

    return collection;
  }

  async update(id: string, dto: UpdateCollectionDto, actorUserId?: string) {
    await this.findById(id);

    if (dto.slug || dto.name) {
      const conflict = await this.prisma.collection.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.slug ? [{ slug: dto.slug.toLowerCase().trim() }] : []),
          ],
        },
      });

      if (conflict) {
        throw new ConflictException(
          "A collection with this name or slug already exists",
        );
      }
    }

    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.slug ? { slug: dto.slug.toLowerCase().trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl?.trim() } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      },
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "collection.update",
        entityType: "Collection",
        entityId: collection.id,
        changes: dto,
      });
    }

    return collection;
  }

  async delete(id: string, actorUserId?: string) {
    const collection = await this.findById(id);

    await this.prisma.collection.delete({ where: { id } });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "collection.delete",
        entityType: "Collection",
        entityId: id,
        changes: { name: collection.name },
      });
    }

    return { message: "Collection deleted successfully" };
  }

  async addProductToCollection(
    collectionId: string,
    productId: string,
    actorUserId?: string,
  ) {
    await this.findById(collectionId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const existingLink = await this.prisma.productCollection.findUnique({
      where: {
        productId_collectionId: {
          productId,
          collectionId,
        },
      },
    });

    if (existingLink) {
      return { message: "Product is already in collection" };
    }

    await this.prisma.productCollection.create({
      data: { productId, collectionId },
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "collection.add-product",
        entityType: "Collection",
        entityId: collectionId,
        changes: { productId },
      });
    }

    return { message: "Product added to collection successfully" };
  }

  async removeProductFromCollection(
    collectionId: string,
    productId: string,
    actorUserId?: string,
  ) {
    await this.findById(collectionId);

    await this.prisma.productCollection.deleteMany({
      where: { collectionId, productId },
    });

    if (actorUserId) {
      await this.auditLogService.record({
        userId: actorUserId,
        action: "collection.remove-product",
        entityType: "Collection",
        entityId: collectionId,
        changes: { productId },
      });
    }

    return { message: "Product removed from collection successfully" };
  }
}
