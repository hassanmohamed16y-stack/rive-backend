import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { validate } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AdminCustomersController } from "./admin-customers.controller";
import { CustomersService } from "./customers.service";
import { SendCustomerEmailDto } from "./dto/send-customer-email.dto";

describe("AdminCustomersController", () => {
  let controller: AdminCustomersController;
  let permissionsGuard: PermissionsGuard;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    findByEmail: jest.Mock;
    findCustomerOrders: jest.Mock;
    getCustomerActivity: jest.Mock;
    blockCustomer: jest.Mock;
    unblockCustomer: jest.Mock;
    deleteCustomer: jest.Mock;
    sendCustomerEmail: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      findCustomerOrders: jest.fn(),
      getCustomerActivity: jest.fn(),
      blockCustomer: jest.fn(),
      unblockCustomer: jest.fn(),
      deleteCustomer: jest.fn(),
      sendCustomerEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCustomersController],
      providers: [
        Reflector,
        PermissionsGuard,
        {
          provide: CustomersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AdminCustomersController>(AdminCustomersController);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("delegates to customersService.findAll", async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      service.findAll.mockResolvedValue(mockResult);

      const query = { search: "alice", tier: "VIP", page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(mockResult);
    });
  });

  describe("findByEmail", () => {
    it("delegates to customersService.findByEmail", async () => {
      const mockProfile = { id: "c1", email: "alice@example.com" };
      service.findByEmail.mockResolvedValue(mockProfile);

      const result = await controller.findByEmail("alice@example.com");

      expect(service.findByEmail).toHaveBeenCalledWith("alice@example.com");
      expect(result).toBe(mockProfile);
    });
  });

  describe("findCustomerOrders", () => {
    it("delegates to customersService.findCustomerOrders", async () => {
      const mockOrders = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      service.findCustomerOrders.mockResolvedValue(mockOrders);

      const result = await controller.findCustomerOrders("c1", { page: 1, limit: 10 });

      expect(service.findCustomerOrders).toHaveBeenCalledWith("c1", { page: 1, limit: 10 });
      expect(result).toBe(mockOrders);
    });
  });

  describe("findCustomerActivity", () => {
    it("delegates to customersService.getCustomerActivity", async () => {
      const mockActivity = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      service.getCustomerActivity.mockResolvedValue(mockActivity);

      const result = await controller.findCustomerActivity("c1", { page: 1, limit: 10 });

      expect(service.getCustomerActivity).toHaveBeenCalledWith("c1", { page: 1, limit: 10 });
      expect(result).toBe(mockActivity);
    });
  });

  describe("findOne", () => {
    it("delegates to customersService.findOne", async () => {
      const mockProfile = { id: "c1", name: "Alice" };
      service.findOne.mockResolvedValue(mockProfile);

      const result = await controller.findOne("c1");

      expect(service.findOne).toHaveBeenCalledWith("c1");
      expect(result).toBe(mockProfile);
    });
  });

  describe("blockCustomer", () => {
    it("delegates to customersService.blockCustomer", async () => {
      const mockProfile = { id: "c1", name: "Alice" };
      service.blockCustomer.mockResolvedValue(mockProfile);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.blockCustomer("c1", req);

      expect(service.blockCustomer).toHaveBeenCalledWith("c1", "admin-1");
      expect(result).toBe(mockProfile);
    });
  });

  describe("unblockCustomer", () => {
    it("delegates to customersService.unblockCustomer", async () => {
      const mockProfile = { id: "c1", name: "Alice" };
      service.unblockCustomer.mockResolvedValue(mockProfile);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.unblockCustomer("c1", req);

      expect(service.unblockCustomer).toHaveBeenCalledWith("c1", "admin-1");
      expect(result).toBe(mockProfile);
    });
  });

  describe("deleteCustomer", () => {
    it("delegates to customersService.deleteCustomer", async () => {
      const mockProfile = { id: "c1", name: "Anonymized User" };
      service.deleteCustomer.mockResolvedValue(mockProfile);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.deleteCustomer("c1", req);

      expect(service.deleteCustomer).toHaveBeenCalledWith("c1", "admin-1");
      expect(result).toBe(mockProfile);
    });
  });

  describe("sendEmail", () => {
    it("delegates to customersService.sendCustomerEmail", async () => {
      const mockResponse = { success: true };
      service.sendCustomerEmail.mockResolvedValue(mockResponse);

      const dto = { subject: "Hello", message: "World" };
      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.sendEmail("c1", dto, req);

      expect(service.sendCustomerEmail).toHaveBeenCalledWith("c1", dto, "admin-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("PermissionsGuard integration for sendEmail route", () => {
    function createMockContext(user: any): ExecutionContext {
      return {
        getHandler: () => controller.sendEmail,
        getClass: () => AdminCustomersController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    }

    it("allows full_admin user regardless of permissions", () => {
      const context = createMockContext({
        id: "admin-1",
        roleName: "full_admin",
        permissions: [],
      });

      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it("allows user with customers.update permission", () => {
      const context = createMockContext({
        id: "staff-1",
        roleName: "support",
        permissions: ["customers.update"],
      });

      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it("denies (throws ForbiddenException) for user without customers.update permission", () => {
      const context = createMockContext({
        id: "staff-2",
        roleName: "support",
        permissions: ["customers.view"],
      });

      expect(() => permissionsGuard.canActivate(context)).toThrow();
    });
  });

  describe("SendCustomerEmailDto validation", () => {
    it("passes for valid subject and message", async () => {
      const dto = new SendCustomerEmailDto();
      dto.subject = "Notice";
      dto.message = "Hello customer";

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("fails when subject is empty or exceeds 150 characters", async () => {
      const dto = new SendCustomerEmailDto();
      dto.subject = "a".repeat(151);
      dto.message = "Valid message";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("subject");
    });

    it("fails when message is empty or exceeds 5000 characters", async () => {
      const dto = new SendCustomerEmailDto();
      dto.subject = "Valid subject";
      dto.message = "a".repeat(5001);

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("message");
    });
  });
});
