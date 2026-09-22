import { Test, TestingModule } from "@nestjs/testing";
import { WorkflowTrustLevel } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";

describe("AutomationController", () => {
  let controller: AutomationController;
  let service: jest.Mocked<AutomationService>;

  beforeEach(async () => {
    const mockService = {
      getWorkflows: jest.fn(),
      toggleWorkflow: jest.fn(),
      updateTrustLevel: jest.fn(),
      getRuns: jest.fn(),
      getPendingApprovals: jest.fn(),
      approvePendingApproval: jest.fn(),
      rejectPendingApproval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationController],
      providers: [{ provide: AutomationService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AutomationController>(AutomationController);
    service = module.get(AutomationService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getWorkflows", () => {
    it("delegates to automationService.getWorkflows", async () => {
      const mockWorkflows = [{ id: "wf-1", name: "Workflow 1" }];
      service.getWorkflows.mockResolvedValue(mockWorkflows as any);

      const result = await controller.getWorkflows();
      expect(result).toEqual(mockWorkflows);
      expect(service.getWorkflows).toHaveBeenCalledTimes(1);
    });
  });

  describe("toggleWorkflow", () => {
    it("delegates to automationService.toggleWorkflow with user id and dto", async () => {
      const mockUpdated = { id: "wf-1", isActive: false };
      service.toggleWorkflow.mockResolvedValue(mockUpdated as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { isActive: false };
      const result = await controller.toggleWorkflow("wf-1", dto, req);

      expect(result).toEqual(mockUpdated);
      expect(service.toggleWorkflow).toHaveBeenCalledWith("wf-1", "admin-1", dto);
    });
  });

  describe("updateTrustLevel", () => {
    it("delegates to automationService.updateTrustLevel with user id and trust level", async () => {
      const mockUpdated = {
        id: "wf-1",
        trustLevel: WorkflowTrustLevel.auto_execute,
      };
      service.updateTrustLevel.mockResolvedValue(mockUpdated as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { trustLevel: WorkflowTrustLevel.auto_execute };
      const result = await controller.updateTrustLevel("wf-1", dto, req);

      expect(result).toEqual(mockUpdated);
      expect(service.updateTrustLevel).toHaveBeenCalledWith(
        "wf-1",
        WorkflowTrustLevel.auto_execute,
        "admin-1",
      );
    });
  });

  describe("getRuns", () => {
    it("delegates to automationService.getRuns with query parameters", async () => {
      const mockRunsResponse = {
        data: [{ id: "run-1" }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      service.getRuns.mockResolvedValue(mockRunsResponse as any);

      const query = { page: 1, limit: 20, workflowId: "wf-1" };
      const result = await controller.getRuns(query);

      expect(result).toEqual(mockRunsResponse);
      expect(service.getRuns).toHaveBeenCalledWith(query);
    });
  });

  describe("getPendingApprovals", () => {
    it("delegates to automationService.getPendingApprovals with query parameters", async () => {
      const mockApprovals = [{ id: "pa-1", status: "pending" }];
      service.getPendingApprovals.mockResolvedValue(mockApprovals as any);

      const query = { status: "pending" as any };
      const result = await controller.getPendingApprovals(query);

      expect(result).toEqual(mockApprovals);
      expect(service.getPendingApprovals).toHaveBeenCalledWith(query);
    });
  });

  describe("approvePendingApproval", () => {
    it("delegates to automationService.approvePendingApproval with user id", async () => {
      const mockApproved = { id: "pa-1", status: "approved" };
      service.approvePendingApproval.mockResolvedValue(mockApproved as any);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.approvePendingApproval("pa-1", req);

      expect(result).toEqual(mockApproved);
      expect(service.approvePendingApproval).toHaveBeenCalledWith("pa-1", "admin-1");
    });
  });

  describe("rejectPendingApproval", () => {
    it("delegates to automationService.rejectPendingApproval with user id", async () => {
      const mockRejected = { id: "pa-1", status: "rejected" };
      service.rejectPendingApproval.mockResolvedValue(mockRejected as any);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.rejectPendingApproval("pa-1", req);

      expect(result).toEqual(mockRejected);
      expect(service.rejectPendingApproval).toHaveBeenCalledWith("pa-1", "admin-1");
    });
  });
});
