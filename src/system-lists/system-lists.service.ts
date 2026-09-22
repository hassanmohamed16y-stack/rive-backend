import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { CreateListItemDto } from "./dto/create-list-item.dto";
import { UpdateListItemDto } from "./dto/update-list-item.dto";

@Injectable()
export class SystemListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAllTypes() {
    return this.prisma.listType.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { key: "asc" },
    });
  }

  async findItemsByTypeKey(listTypeKey: string, includeInactive = false) {
    const listType = await this.prisma.listType.findUnique({
      where: { key: listTypeKey },
    });

    if (!listType) {
      throw new NotFoundException(`List type "${listTypeKey}" was not found`);
    }

    const where: Prisma.ListItemWhereInput = {
      listTypeId: listType.id,
      ...(includeInactive ? {} : { isActive: true }),
    };

    return this.prisma.listItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async createItem(
    listTypeKey: string,
    dto: CreateListItemDto,
    actorUserId?: string,
  ) {
    const listType = await this.prisma.listType.findUnique({
      where: { key: listTypeKey },
    });

    if (!listType) {
      throw new NotFoundException(`List type "${listTypeKey}" was not found`);
    }

    let item;
    try {
      item = await this.prisma.listItem.create({
        data: {
          listTypeId: listType.id,
          key: dto.key,
          labelAr: dto.labelAr,
          labelEn: dto.labelEn,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          `ListItem with key "${dto.key}" already exists in list type "${listTypeKey}"`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: "system_list_item.create",
      entityType: "ListItem",
      entityId: item.id,
      changes: {
        listTypeKey,
        ...dto,
      },
    });

    return item;
  }

  async updateItem(
    id: string,
    dto: UpdateListItemDto,
    actorUserId?: string,
  ) {
    try {
      const item = await this.prisma.listItem.update({
        where: { id },
        data: {
          ...(dto.key !== undefined ? { key: dto.key } : {}),
          ...(dto.labelAr !== undefined ? { labelAr: dto.labelAr } : {}),
          ...(dto.labelEn !== undefined ? { labelEn: dto.labelEn } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "system_list_item.update",
        entityType: "ListItem",
        entityId: item.id,
        changes: dto,
      });

      return item;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        throw new NotFoundException(`ListItem ${id} was not found`);
      }
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          `ListItem with key "${dto.key}" already exists in this list type`,
        );
      }
      throw error;
    }
  }

  async deactivateItem(id: string, actorUserId?: string) {
    try {
      const item = await this.prisma.listItem.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "system_list_item.deactivate",
        entityType: "ListItem",
        entityId: item.id,
        changes: { isActive: false },
      });

      return item;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        throw new NotFoundException(`ListItem ${id} was not found`);
      }
      throw error;
    }
  }
}
