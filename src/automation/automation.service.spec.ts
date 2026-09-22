import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PendingApprovalStatus, WorkflowTrustLevel } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationService } from "./automation.service";

describe("AutomationService", () => {
  let service: AutomationService;
  let prisma: {
    workflow: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    automationRun: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    pendingApproval: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditLogService: {
    record: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      workflow: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      automationRun: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      pendingApproval: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLogService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getWorkflows", () => {
    it("returns list of workflows ordered by createdAt desc", async () => {
      const mockWorkflows = [{ id: "wf-1", name: "Workflow 1", isActive: true }];
      prisma.workflow.findMany.mockResolvedValue(mockWorkflows);

      const result = await service.getWorkflows();
      expect(result).toEqual(mockWorkflows);
      expect(prisma.workflow.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("toggleWorkflow", () => {
    it("throws NotFoundException if workflow does not exist", async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleWorkflow("non-existent", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("toggles isActive state when dto is omitted", async () => {
      prisma.workflow.findUnique.mockResolvedValue({
        id: "wf-1",
        isActive: true,
      });
      prisma.workflow.update.mockResolvedValue({
        id: "wf-1",
        isActive: false,
      });

      const result = await service.toggleWorkflow("wf-1", "user-1");

      expect(result.isActive).toBe(false);
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: "wf-1" },
        data: { isActive: false },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "user-1",
        action: "automation.workflow.toggle",
        entityType: "Workflow",
        entityId: "wf-1",
        changes: { isActive: false },
      });
    });

    it("sets isActive to explicit value when dto is provided", async () => {
      prisma.workflow.findUnique.mockResolvedValue({
        id: "wf-1",
        isActive: false,
      });
      prisma.workflow.update.mockResolvedValue({
        id: "wf-1",
        isActive: true,
      });

      const result = await service.toggleWorkflow("wf-1", "user-1", {
        isActive: true,
      });

      expect(result.isActive).toBe(true);
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: "wf-1" },
        data: { isActive: true },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "user-1",
        action: "automation.workflow.toggle",
        entityType: "Workflow",
        entityId: "wf-1",
        changes: { isActive: true },
      });
    });
  });

  describe("updateTrustLevel", () => {
    it("throws NotFoundException if workflow does not exist", async () => {
      prisma.workflow.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTrustLevel(
          "non-existent",
          WorkflowTrustLevel.auto_execute,
          "user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates trustLevel and records audit log", async () => {
      prisma.workflow.findUnique.mockResolvedValue({
        id: "wf-1",
        trustLevel: WorkflowTrustLevel.requires_approval,
      });
      prisma.workflow.update.mockResolvedValue({
        id: "wf-1",
        trustLevel: WorkflowTrustLevel.auto_execute,
      });

      const result = await service.updateTrustLevel(
        "wf-1",
        WorkflowTrustLevel.auto_execute,
        "user-1",
      );

      expect(result.trustLevel).toBe(WorkflowTrustLevel.auto_execute);
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: "wf-1" },
        data: { trustLevel: WorkflowTrustLevel.auto_execute },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "user-1",
        action: "automation.workflow.trust_level_change",
        entityType: "Workflow",
        entityId: "wf-1",
        changes: { trustLevel: WorkflowTrustLevel.auto_execute },
      });
    });
  });

  describe("getRuns", () => {
    it("returns paginated run logs", async () => {
      const mockRuns = [{ id: "run-1", workflowId: "wf-1" }];
      prisma.automationRun.findMany.mockResolvedValue(mockRuns);
      prisma.automationRun.count.mockResolvedValue(1);

      const result = await service.getRuns({ page: 1, limit: 10 });

      expect(result).toEqual({
        data: mockRuns,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.automationRun.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
      });
    });

    it("filters runs by workflowId when provided", async () => {
      prisma.automationRun.findMany.mockResolvedValue([]);
      prisma.automationRun.count.mockResolvedValue(0);

      await service.getRuns({ page: 1, limit: 10, workflowId: "wf-1" });

      expect(prisma.automationRun.findMany).toHaveBeenCalledWith({
        where: { workflowId: "wf-1" },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
      });
    });
  });

  describe("getPendingApprovals", () => {
    it("returns pending approvals with default filter status=pending", async () => {
      const mockApprovals = [{ id: "pa-1", status: "pending" }];
      prisma.pendingApproval.findMany.mockResolvedValue(mockApprovals);

      const result = await service.getPendingApprovals();

      expect(result).toEqual(mockApprovals);
      expect(prisma.pendingApproval.findMany).toHaveBeenCalledWith({
        where: { status: PendingApprovalStatus.pending },
        orderBy: { createdAt: "desc" },
        include: {
          workflow: { select: { id: true, name: true } },
          resolvedByUser: { select: { id: true, fullName: true, email: true } },
        },
      });
    });
  });

  describe("approvePendingApproval", () => {
    it("throws NotFoundException if approval does not exist", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue(null);

      await expect(
        service.approvePendingApproval("non-existent", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if approval is not pending", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.approved,
      });

      await expect(
        service.approvePendingApproval("pa-1", "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("approves pending approval and logs audit entry", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.pending,
      });
      prisma.pendingApproval.update.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.approved,
        resolvedByUserId: "user-1",
      });

      const result = await service.approvePendingApproval("pa-1", "user-1");

      expect(result.status).toBe(PendingApprovalStatus.approved);
      expect(prisma.pendingApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pa-1" },
          data: expect.objectContaining({
            status: PendingApprovalStatus.approved,
            resolvedByUserId: "user-1",
          }),
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "user-1",
        action: "automation.pending_approval.approve",
        entityType: "PendingApproval",
        entityId: "pa-1",
        changes: {
          status: PendingApprovalStatus.approved,
          resolvedByUserId: "user-1",
        },
      });
    });
  });

  describe("rejectPendingApproval", () => {
    it("throws NotFoundException if approval does not exist", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectPendingApproval("non-existent", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if approval is not pending", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.rejected,
      });

      await expect(
        service.rejectPendingApproval("pa-1", "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects pending approval and logs audit entry", async () => {
      prisma.pendingApproval.findUnique.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.pending,
      });
      prisma.pendingApproval.update.mockResolvedValue({
        id: "pa-1",
        status: PendingApprovalStatus.rejected,
        resolvedByUserId: "user-1",
      });

      const result = await service.rejectPendingApproval("pa-1", "user-1");

      expect(result.status).toBe(PendingApprovalStatus.rejected);
      expect(prisma.pendingApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pa-1" },
          data: expect.objectContaining({
            status: PendingApprovalStatus.rejected,
            resolvedByUserId: "user-1",
          }),
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "user-1",
        action: "automation.pending_approval.reject",
        entityType: "PendingApproval",
        entityId: "pa-1",
        changes: {
          status: PendingApprovalStatus.rejected,
          resolvedByUserId: "user-1",
        },
      });
    });
  });
});
