import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PendingApprovalStatus, WorkflowTrustLevel } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { GetPendingApprovalsQueryDto } from "./dto/get-pending-approvals-query.dto";
import { GetRunsQueryDto } from "./dto/get-runs-query.dto";
import { ToggleWorkflowDto } from "./dto/toggle-workflow.dto";

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getWorkflows() {
    return this.prisma.workflow.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async toggleWorkflow(id: string, userId: string, dto?: ToggleWorkflowDto) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }

    const newIsActive =
      dto?.isActive !== undefined ? dto.isActive : !workflow.isActive;

    // TODO: call n8n API here
    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { isActive: newIsActive },
    });

    await this.auditLogService.record({
      userId,
      action: "automation.workflow.toggle",
      entityType: "Workflow",
      entityId: id,
      changes: { isActive: updated.isActive },
    });

    return updated;
  }

  async updateTrustLevel(
    id: string,
    trustLevel: WorkflowTrustLevel,
    userId: string,
  ) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { trustLevel },
    });

    await this.auditLogService.record({
      userId,
      action: "automation.workflow.trust_level_change",
      entityType: "Workflow",
      entityId: id,
      changes: { trustLevel: updated.trustLevel },
    });

    return updated;
  }

  async getRuns(query: GetRunsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = query.workflowId ? { workflowId: query.workflowId } : {};

    const [items, total] = await Promise.all([
      this.prisma.automationRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.automationRun.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPendingApprovals(query?: GetPendingApprovalsQueryDto) {
    const where = query?.status ? { status: query.status } : { status: PendingApprovalStatus.pending };

    return this.prisma.pendingApproval.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async approvePendingApproval(id: string, userId: string) {
    const approval = await this.prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException("Pending approval not found");
    }

    if (approval.status !== PendingApprovalStatus.pending) {
      throw new BadRequestException(
        "Pending approval has already been resolved",
      );
    }

    // TODO: trigger actual action via n8n
    const updated = await this.prisma.pendingApproval.update({
      where: { id },
      data: {
        status: PendingApprovalStatus.approved,
        resolvedAt: new Date(),
        resolvedByUserId: userId,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId,
      action: "automation.pending_approval.approve",
      entityType: "PendingApproval",
      entityId: id,
      changes: { status: updated.status, resolvedByUserId: userId },
    });

    return updated;
  }

  async rejectPendingApproval(id: string, userId: string) {
    const approval = await this.prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException("Pending approval not found");
    }

    if (approval.status !== PendingApprovalStatus.pending) {
      throw new BadRequestException(
        "Pending approval has already been resolved",
      );
    }

    const updated = await this.prisma.pendingApproval.update({
      where: { id },
      data: {
        status: PendingApprovalStatus.rejected,
        resolvedAt: new Date(),
        resolvedByUserId: userId,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      userId,
      action: "automation.pending_approval.reject",
      entityType: "PendingApproval",
      entityId: id,
      changes: { status: updated.status, resolvedByUserId: userId },
    });

    return updated;
  }
}
