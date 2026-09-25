import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { ApproveReviewDto } from "./dto/approve-review.dto";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createReview(
    productId: string,
    dto: CreateReviewDto,
    customerId?: string,
    authorName?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }

    return this.prisma.review.create({
      data: {
        productId,
        customerId: customerId || null,
        authorName: authorName || dto.authorName || "Guest Customer",
        rating: dto.rating,
        comment: dto.comment,
        isApproved: false,
      },
    });
  }

  async getApprovedReviewsForProduct(productId: string, pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where = { productId, isApproved: true };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findAllAdmin(isApproved?: boolean, pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where = isApproved !== undefined ? { isApproved } : {};

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async setApproval(id: string, dto: ApproveReviewDto, actorUserId?: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review ${id} was not found`);
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: { isApproved: dto.isApproved },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "review.approval",
      entityType: "Review",
      entityId: id,
      changes: dto,
    });

    return updated;
  }

  async removeReview(id: string, actorUserId?: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review ${id} was not found`);
    }

    await this.prisma.review.delete({ where: { id } });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "review.delete",
      entityType: "Review",
      entityId: id,
      changes: { deleted: true },
    });

    return { success: true };
  }
}
