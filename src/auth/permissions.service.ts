import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createPermission(dto: CreatePermissionDto, performingUserId: string) {
    const key = dto.key.trim();
    const label = (dto.name ?? dto.label)?.trim();

    if (!label) {
      throw new BadRequestException("Permission name/label is required");
    }

    const existing = await this.prisma.permission.findUnique({
      where: { key },
    });

    if (existing) {
      throw new ConflictException(`Permission key '${key}' already exists`);
    }

    const permission = await this.prisma.permission.create({
      data: {
        key,
        label,
      },
    });

    // Auto-assign new permission to full_admin role if full_admin exists
    const fullAdminRole = await this.prisma.role.findUnique({
      where: { name: "full_admin" },
    });

    if (fullAdminRole) {
      await this.prisma.rolePermission.create({
        data: {
          roleId: fullAdminRole.id,
          permissionId: permission.id,
        },
      }).catch(() => {
        // Ignore duplicate constraint if already exists
      });
    }

    await this.auditLogService.record({
      userId: performingUserId,
      action: "permission.created",
      entityType: "Permission",
      entityId: permission.id,
      changes: { key: permission.key, label: permission.label },
    });

    return permission;
  }

  async findAllPermissionsGrouped() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { key: "asc" },
    });

    const grouped: Record<
      string,
      Array<{ id: string; key: string; label: string; createdAt: Date }>
    > = {};

    for (const perm of permissions) {
      const department = perm.key.includes(".")
        ? perm.key.split(".")[0]
        : "general";

      if (!grouped[department]) {
        grouped[department] = [];
      }

      grouped[department].push({
        id: perm.id,
        key: perm.key,
        label: perm.label,
        createdAt: perm.createdAt,
      });
    }

    return grouped;
  }
}
