import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateInternalNoteDto } from "./dto/create-internal-note.dto";
import { UpdateInternalNoteDto } from "./dto/update-internal-note.dto";

@Injectable()
export class InternalNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateInternalNoteDto, createdById?: string) {
    const note = await this.prisma.internalNote.create({
      data: {
        content: dto.content,
        entityType: dto.entityType,
        entityId: dto.entityId,
        createdById: createdById ?? null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId: createdById,
      action: "internal_note.create",
      entityType: dto.entityType,
      entityId: dto.entityId,
      changes: dto,
    });

    return note;
  }

  async findAll(entityType?: string, entityId?: string) {
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    return this.prisma.internalNote.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const note = await this.prisma.internalNote.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(`Internal note ${id} not found`);
    }

    return note;
  }

  async update(id: string, dto: UpdateInternalNoteDto, actorUserId?: string) {
    const existing = await this.prisma.internalNote.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Internal note ${id} not found`);
    }

    const updated = await this.prisma.internalNote.update({
      where: { id },
      data: {
        ...(dto.content ? { content: dto.content } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "internal_note.update",
      entityType: existing.entityType,
      entityId: existing.entityId,
      changes: dto,
    });

    return updated;
  }

  async remove(id: string, actorUserId?: string) {
    const existing = await this.prisma.internalNote.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Internal note ${id} not found`);
    }

    await this.prisma.internalNote.delete({
      where: { id },
    });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "internal_note.delete",
      entityType: existing.entityType,
      entityId: existing.entityId,
      changes: { deleted: true },
    });

    return { success: true };
  }
}
