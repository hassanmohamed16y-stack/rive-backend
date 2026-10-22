import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { DEFAULT_PERMISSIONS } from "./default-permissions";

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

  /**
   * Makes sure every built-in permission exists (production databases that were never
   * seeded would otherwise show an empty permissions list and no role could be edited).
   * New rows are also granted to the full_admin role, if it exists.
   */
  private async ensureDefaultPermissions(existingKeys: Set<string>) {
    const missing = DEFAULT_PERMISSIONS.filter((p) => !existingKeys.has(p.key));
    if (missing.length === 0) return false;

    await this.prisma.permission.createMany({
      data: missing.map((p) => ({ key: p.key, label: p.label })),
      skipDuplicates: true,
    });

    const fullAdminRole = await this.prisma.role.findUnique({
      where: { name: "full_admin" },
    });
    if (fullAdminRole) {
      const created = await this.prisma.permission.findMany({
        where: { key: { in: missing.map((p) => p.key) } },
        select: { id: true },
      });
      await this.prisma.rolePermission.createMany({
        data: created.map((p) => ({
          roleId: fullAdminRole.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
    return true;
  }

  async findAllPermissionsGrouped() {
    let permissions = await this.prisma.permission.findMany({
      orderBy: { key: "asc" },
    });

    if (await this.ensureDefaultPermissions(new Set(permissions.map((p) => p.key)))) {
      permissions = await this.prisma.permission.findMany({
        orderBy: { key: "asc" },
      });
    }

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
