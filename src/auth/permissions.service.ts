import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import {
  LEGACY_EXTRA_GRANTS,
  LEGACY_PERMISSION_MAP,
  PERMISSION_CATALOG,
  groupOfPermission,
} from "./permission-catalog";

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

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

  async onModuleInit() {
    try {
      await this.syncPermissionCatalog();
    } catch (error) {
      // Never block boot: the catalog is also synced lazily when the permissions list is opened.
      this.logger.warn(`Permission catalog sync failed: ${(error as Error).message}`);
    }
  }

  /**
   * Makes sure every permission in PERMISSION_CATALOG exists, grants all of them to full_admin,
   * and (once) converts roles that still hold the old coarse permissions (e.g. products.edit,
   * content.manage) to the equivalent fine-grained ones so nobody gains or loses access.
   * Returns true when anything was written.
   */
  async syncPermissionCatalog(
    knownPermissions?: Array<{ id: string; key: string }>,
  ): Promise<boolean> {
    const existing =
      knownPermissions ??
      (await this.prisma.permission.findMany({ select: { id: true, key: true } }));
    const keys = new Set(existing.map((p) => p.key));
    const missing = PERMISSION_CATALOG.filter((p) => !keys.has(p.key));
    const legacyRows = existing.filter((p) => p.key in LEGACY_PERMISSION_MAP);
    // "reviews.view" only exists once the split has happened; before that, roles holding the
    // unchanged keys orders.view / products.view also need their new related permissions.
    const preSplit = !keys.has("reviews.view");

    if (missing.length === 0 && legacyRows.length === 0) return false;

    if (missing.length > 0) {
      await this.prisma.permission.createMany({
        data: missing.map((p) => ({ key: p.key, label: p.label })),
        skipDuplicates: true,
      });
    }

    const all = await this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
    const idByKey = new Map<string, string>(all.map((p) => [p.key, p.id] as [string, string]));

    if (legacyRows.length > 0 || preSplit) {
      const sourceKeys = [
        ...Object.keys(LEGACY_PERMISSION_MAP),
        ...(preSplit ? Object.keys(LEGACY_EXTRA_GRANTS) : []),
      ];
      const holders = await this.prisma.rolePermission.findMany({
        where: { permission: { key: { in: sourceKeys } } },
        select: { roleId: true, permission: { select: { key: true } } },
      });
      const grants: Array<{ roleId: string; permissionId: string }> = [];
      for (const holder of holders) {
        const oldKey = holder.permission.key;
        const targets = [
          ...(LEGACY_PERMISSION_MAP[oldKey] ?? []),
          ...(preSplit ? LEGACY_EXTRA_GRANTS[oldKey] ?? [] : []),
        ];
        for (const target of targets) {
          const permissionId = idByKey.get(target);
          if (permissionId) grants.push({ roleId: holder.roleId, permissionId });
        }
      }
      if (grants.length > 0) {
        await this.prisma.rolePermission.createMany({ data: grants, skipDuplicates: true });
      }
    }

    const fullAdminRole = await this.prisma.role.findUnique({
      where: { name: "full_admin" },
    });
    if (fullAdminRole) {
      await this.prisma.rolePermission.createMany({
        data: PERMISSION_CATALOG.map((p) => idByKey.get(p.key))
          .filter((id): id is string => Boolean(id))
          .map((permissionId) => ({ roleId: fullAdminRole.id, permissionId })),
        skipDuplicates: true,
      });
    }

    if (legacyRows.length > 0) {
      const legacyIds = legacyRows.map((p) => p.id);
      await this.prisma.rolePermission.deleteMany({
        where: { permissionId: { in: legacyIds } },
      });
      await this.prisma.permission.deleteMany({ where: { id: { in: legacyIds } } });
    }

    return true;
  }

  async findAllPermissionsGrouped() {
    let permissions = await this.prisma.permission.findMany();

    if (await this.syncPermissionCatalog(permissions)) {
      permissions = await this.prisma.permission.findMany();
    }

    const order = new Map(PERMISSION_CATALOG.map((p, i) => [p.key, i]));
    permissions.sort(
      (a, b) =>
        (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.key) ?? Number.MAX_SAFE_INTEGER) || a.key.localeCompare(b.key),
    );

    const grouped: Record<
      string,
      Array<{ id: string; key: string; label: string; createdAt: Date }>
    > = {};

    for (const perm of permissions) {
      const department = groupOfPermission(perm.key);
      (grouped[department] ??= []).push({
        id: perm.id,
        key: perm.key,
        label: perm.label,
        createdAt: perm.createdAt,
      });
    }

    return grouped;
  }
}
