import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateStaticPageDto } from "./dto/update-static-page.dto";

@Injectable()
export class StaticPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Public lookup by slug.
   * Only returns page if `isPublished` is true. Throws NotFoundException otherwise.
   */
  async findBySlug(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
    });

    if (!page || !page.isPublished) {
      throw new NotFoundException(`Static page "${slug}" not found`);
    }

    return page;
  }

  /**
   * Admin lookup listing all pages (published or not).
   */
  async findAllAdmin() {
    return this.prisma.staticPage.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Admin update title/content/isPublished.
   * Logs edit to audit log.
   */
  async update(id: string, dto: UpdateStaticPageDto, adminUserId?: string) {
    const existing = await this.prisma.staticPage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Static page with ID "${id}" not found`);
    }

    const updated = await this.prisma.staticPage.update({
      where: { id },
      data: {
        ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn } : {}),
        ...(dto.contentAr !== undefined ? { contentAr: dto.contentAr } : {}),
        ...(dto.contentEn !== undefined ? { contentEn: dto.contentEn } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });

    await this.auditLogService.record({
      userId: adminUserId,
      action: "static-page.update",
      entityType: "StaticPage",
      entityId: id,
      changes: {
        before: {
          titleAr: existing.titleAr,
          titleEn: existing.titleEn,
          contentAr: existing.contentAr,
          contentEn: existing.contentEn,
          isPublished: existing.isPublished,
        },
        after: {
          titleAr: updated.titleAr,
          titleEn: updated.titleEn,
          contentAr: updated.contentAr,
          contentEn: updated.contentEn,
          isPublished: updated.isPublished,
        },
      },
    });

    return updated;
  }
}
