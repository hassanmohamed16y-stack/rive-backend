import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildPaginationMeta,
  resolvePagination,
} from "../common/utils/pagination";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private sanitizeUser<T extends { passwordHash?: string; emailVerificationToken?: string | null; passwordResetToken?: string | null }>(user: T) {
    const {
      passwordHash: _passwordHash,
      emailVerificationToken: _emailVerificationToken,
      passwordResetToken: _passwordResetToken,
      ...safeUser
    } = user;
    return safeUser;
  }

  async findAllUsers(
    pagination: { page?: number; limit?: number },
    search?: string,
    roleId?: string,
  ) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const where: Prisma.UserWhereInput = {
      ...(roleId ? { roleId } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roleRecord: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async createUser(dto: CreateUserDto, performingUserId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.name.trim(),
        email: dto.email.toLowerCase(),
        passwordHash: hashedPassword,
        role: dto.roleId ? "ADMIN" : "CUSTOMER",
        roleId: dto.roleId,
        isActive: true,
      },
      include: {
        roleRecord: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId: performingUserId,
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      changes: { email: user.email, roleId: user.roleId },
    });

    return this.sanitizeUser(user);
  }

  async updateUser(
    targetUserId: string,
    dto: UpdateUserDto,
    performingUser: { id: string; permissions?: string[] },
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roleRecord: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    // Safety check: Prevent self-role modification unless Full Admin acting on someone else
    if (targetUserId === performingUser.id && dto.roleId !== undefined && dto.roleId !== targetUser.roleId) {
      throw new ForbiddenException("Users cannot modify their own role");
    }

    // Safety check: Prevent disabling or demoting the last active Full Admin
    if (
      (dto.isActive === false || (dto.roleId !== undefined && dto.roleId !== targetUser.roleId)) &&
      targetUser.roleRecord?.name === "full_admin" &&
      targetUser.isActive
    ) {
      await this.ensureNotLastFullAdmin(targetUserId);
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(dto.name ? { fullName: dto.name.trim() } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        roleRecord: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId: performingUser.id,
      action: "user.updated",
      entityType: "User",
      entityId: updatedUser.id,
      changes: {
        name: dto.name,
        roleId: dto.roleId,
        isActive: dto.isActive,
      },
    });

    return this.sanitizeUser(updatedUser);
  }

  async disableUser(
    targetUserId: string,
    performingUser: { id: string; permissions?: string[] },
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roleRecord: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    if (targetUser.roleRecord?.name === "full_admin" && targetUser.isActive) {
      await this.ensureNotLastFullAdmin(targetUserId);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false, deletedAt: new Date() },
      include: {
        roleRecord: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId: performingUser.id,
      action: "user.disabled",
      entityType: "User",
      entityId: updatedUser.id,
      changes: { isActive: false, deletedAt: updatedUser.deletedAt },
    });

    return this.sanitizeUser(updatedUser);
  }

  async deleteUser(
    targetUserId: string,
    performingUser: { id: string; permissions?: string[] },
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roleRecord: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    if (targetUser.roleRecord?.name === "full_admin" && targetUser.isActive) {
      await this.ensureNotLastFullAdmin(targetUserId);
    }

    await this.prisma.user.delete({
      where: { id: targetUserId },
    });

    await this.auditLogService.record({
      userId: performingUser.id,
      action: "user.delete",
      entityType: "User",
      entityId: targetUserId,
      changes: { deleted: true },
    });

    return { message: "User deleted successfully" };
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }).then((roles) =>
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        label: r.label,
        createdAt: r.createdAt,
        permissions: r.permissions.map((p) => ({
          id: p.permission.id,
          key: p.permission.key,
          label: p.permission.label,
        })),
      })),
    );
  }

  private async ensureNotLastFullAdmin(userIdToExclude: string) {
    const fullAdminRole = await this.prisma.role.findUnique({
      where: { name: "full_admin" },
    });

    if (!fullAdminRole) {
      return;
    }

    const remainingFullAdminsCount = await this.prisma.user.count({
      where: {
        roleId: fullAdminRole.id,
        isActive: true,
        id: { not: userIdToExclude },
      },
    });

    if (remainingFullAdminsCount === 0) {
      throw new BadRequestException(
        "Cannot disable or demote the last remaining active Full Admin user",
      );
    }
  }
}
