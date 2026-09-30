import { Test, TestingModule } from "@nestjs/testing";
import { AdminCustomersController } from "./admin-customers.controller";
import { CustomersService } from "./customers.service";

describe("AdminCustomersController", () => {
  let controller: AdminCustomersController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    findByEmail: jest.Mock;
    findCustomerOrders: jest.Mock;
    getCustomerActivity: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      findCustomerOrders: jest.fn(),
      getCustomerActivity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AdminCustomersController>(AdminCustomersController);
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
});
