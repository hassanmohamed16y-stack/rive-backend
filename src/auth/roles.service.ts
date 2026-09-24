import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private formatRole(role: any) {
    return {
      id: role.id,
      name: role.name,
      label: role.label,
      createdAt: role.createdAt,
      permissions: role.permissions
        ? role.permissions.map((p: any) => ({
            id: p.permission.id,
            key: p.permission.key,
            label: p.permission.label,
            createdAt: p.permission.createdAt,
          }))
        : [],
    };
  }

  async findAllRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return roles.map((r) => this.formatRole(r));
  }

  async findRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return this.formatRole(role);
  }

  async createRole(dto: CreateRoleDto, performingUserId: string) {
    const name = dto.name.trim();
    const label = dto.label.trim();

    const existing = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`Role with name '${name}' already exists`);
    }

    // Resolve permission IDs if permissionKeys or permissionIds were provided
    const rawPerms = [
      ...(dto.permissionKeys ?? []),
      ...(dto.permissionIds ?? []),
    ];

    let permissionRecords: { id: string }[] = [];
    if (rawPerms.length > 0) {
      permissionRecords = await this.prisma.permission.findMany({
        where: {
          OR: [{ key: { in: rawPerms } }, { id: { in: rawPerms } }],
        },
        select: { id: true },
      });
    }

    const createdRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { name, label },
      });

      if (permissionRecords.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRecords.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
          skipDuplicates: true,
        });
      }

      return role;
    });

    await this.auditLogService.record({
      userId: performingUserId,
      action: "role.created",
      entityType: "Role",
      entityId: createdRole.id,
      changes: { name: createdRole.name, label: createdRole.label },
    });

    return this.findRoleById(createdRole.id);
  }

  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    performingUserId: string,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    const updates: { name?: string; label?: string } = {};

    if (dto.name !== undefined) {
      const newName = dto.name.trim();
      if (role.name === "full_admin" && newName !== "full_admin") {
        throw new BadRequestException("Cannot change the name of full_admin role");
      }
      if (newName !== role.name) {
        const existing = await this.prisma.role.findUnique({
          where: { name: newName },
        });
        if (existing) {
          throw new ConflictException(`Role with name '${newName}' already exists`);
        }
        updates.name = newName;
      }
    }

    if (dto.label !== undefined) {
      updates.label = dto.label.trim();
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updates,
    });

    await this.auditLogService.record({
      userId: performingUserId,
      action: "role.updated",
      entityType: "Role",
      entityId: updatedRole.id,
      changes: updates,
    });

    return this.findRoleById(updatedRole.id);
  }

  async deleteRole(id: string, performingUserId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (role.name === "full_admin") {
      throw new BadRequestException("Cannot delete full_admin role");
    }

    const assignedUsersCount = await this.prisma.user.count({
      where: { roleId: id },
    });

    if (assignedUsersCount > 0) {
      throw new BadRequestException(
        `Cannot delete role because ${assignedUsersCount} user(s) are assigned to it`,
      );
    }

    await this.prisma.role.delete({ where: { id } });

    await this.auditLogService.record({
      userId: performingUserId,
      action: "role.deleted",
      entityType: "Role",
      entityId: id,
      changes: { name: role.name },
    });

    return { message: "Role deleted successfully", id };
  }

  async setRolePermissions(
    roleId: string,
    dto: SetRolePermissionsDto,
    performingUserId: string,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const inputList = Array.from(
      new Set([
        ...(dto.permissions ?? []),
        ...(dto.permissionKeys ?? []),
        ...(dto.permissionIds ?? []),
      ]),
    );

    let permissionIds: string[] = [];
    if (inputList.length > 0) {
      const foundPermissions = await this.prisma.permission.findMany({
        where: {
          OR: [{ key: { in: inputList } }, { id: { in: inputList } }],
        },
        select: { id: true, key: true },
      });

      if (foundPermissions.length < inputList.length) {
        const foundIdentifiers = new Set([
          ...foundPermissions.map((p) => p.id),
          ...foundPermissions.map((p) => p.key),
        ]);
        const missing = inputList.filter((item) => !foundIdentifiers.has(item));
        throw new BadRequestException(
          `The following permissions do not exist: ${missing.join(", ")}`,
        );
      }

      permissionIds = foundPermissions.map((p) => p.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    await this.auditLogService.record({
      userId: performingUserId,
      action: "role.permissions-updated",
      entityType: "Role",
      entityId: roleId,
      changes: { permissionIdsCount: permissionIds.length },
    });

    return this.findRoleById(roleId);
  }
}
