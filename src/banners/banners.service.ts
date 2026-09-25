import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { UploadService } from "../upload/upload.service";
import { UploadedImageFile } from "../upload/uploaded-image-file.type";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * PUBLIC: Returns active banners whose date range includes current time, sorted by sortOrder.
   */
  async findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        AND: [
          {
            OR: [{ publishAt: null }, { publishAt: { lte: now } }],
          },
          {
            OR: [{ unpublishAt: null }, { unpublishAt: { gte: now } }],
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  /**
   * ADMIN: Returns all banners including expired, upcoming, and inactive ones.
   */
  async findAllAdmin() {
    return this.prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  /**
   * ADMIN: Create a new banner with optional Cloudinary file upload or direct imageUrl.
   */
  async create(
    dto: CreateBannerDto,
    file?: UploadedImageFile,
    userId?: string,
  ) {
    let imageUrl = dto.imageUrl;

    if (file) {
      const uploadResult = await this.uploadService.uploadImage(file);
      imageUrl = uploadResult.url;
    }

    if (!imageUrl) {
      throw new BadRequestException("Image file or imageUrl is required");
    }

    if (dto.endsAt <= dto.startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    const banner = await this.prisma.banner.create({
      data: {
        titleAr: dto.titleAr,
        subtitleAr: dto.subtitleAr,
        imageUrl,
        linkUrl: dto.linkUrl,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        publishAt: dto.publishAt,
        unpublishAt: dto.unpublishAt,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLogService.record({
      userId,
      action: "CREATE_BANNER",
      entityType: "BANNER",
      entityId: banner.id,
      changes: banner,
    });

    return banner;
  }

  /**
   * ADMIN: Update an existing banner by ID.
   */
  async update(
    id: string,
    dto: UpdateBannerDto,
    file?: UploadedImageFile,
    userId?: string,
  ) {
    const existingBanner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      throw new NotFoundException("Banner not found");
    }

    let imageUrl = existingBanner.imageUrl;

    if (file) {
      const uploadResult = await this.uploadService.uploadImage(file);
      imageUrl = uploadResult.url;
    } else if (dto.imageUrl) {
      imageUrl = dto.imageUrl;
    }

    const startsAt = dto.startsAt ?? existingBanner.startsAt;
    const endsAt = dto.endsAt ?? existingBanner.endsAt;

    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    const updatedBanner = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr } : {}),
        ...(dto.subtitleAr !== undefined ? { subtitleAr: dto.subtitleAr } : {}),
        imageUrl,
        ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl } : {}),
        startsAt,
        endsAt,
        ...(dto.publishAt !== undefined ? { publishAt: dto.publishAt } : {}),
        ...(dto.unpublishAt !== undefined ? { unpublishAt: dto.unpublishAt } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditLogService.record({
      userId,
      action: "UPDATE_BANNER",
      entityType: "BANNER",
      entityId: updatedBanner.id,
      changes: dto,
    });

    return updatedBanner;
  }

  /**
   * ADMIN: Hard-delete a banner by ID.
   */
  async delete(id: string, userId?: string) {
    const existingBanner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      throw new NotFoundException("Banner not found");
    }

    await this.prisma.banner.delete({
      where: { id },
    });

    await this.auditLogService.record({
      userId,
      action: "DELETE_BANNER",
      entityType: "BANNER",
      entityId: id,
      changes: existingBanner,
    });

    return { success: true };
  }
}
