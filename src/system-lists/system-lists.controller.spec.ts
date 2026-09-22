import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RolesGuard } from "../auth/roles.guard";
import { SystemListsController } from "./system-lists.controller";
import { SystemListsService } from "./system-lists.service";

describe("SystemListsController", () => {
  let controller: SystemListsController;
  let service: jest.Mocked<SystemListsService>;

  beforeEach(async () => {
    const mockService = {
      findAllTypes: jest.fn(),
      findItemsByTypeKey: jest.fn(),
      createItem: jest.fn(),
      updateItem: jest.fn(),
      deactivateItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemListsController],
      providers: [{ provide: SystemListsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SystemListsController>(SystemListsController);
    service = module.get(SystemListsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAllTypes", () => {
    it("delegates to systemListsService.findAllTypes", async () => {
      const mockTypes = [{ id: "1", key: "product_category", label: "أقسان المنتجات" }];
      service.findAllTypes.mockResolvedValue(mockTypes as any);

      const result = await controller.findAllTypes();

      expect(result).toEqual(mockTypes);
      expect(service.findAllTypes).toHaveBeenCalledTimes(1);
    });
  });

  describe("findItems", () => {
    it("delegates to systemListsService.findItemsByTypeKey with query parameters", async () => {
      const mockItems = [{ id: "1", key: "clothing", labelAr: "ملابس", isActive: true }];
      service.findItemsByTypeKey.mockResolvedValue(mockItems as any);

      const result = await controller.findItems("product_category", { includeInactive: false });

      expect(result).toEqual(mockItems);
      expect(service.findItemsByTypeKey).toHaveBeenCalledWith("product_category", false);
    });
  });

  describe("createItem", () => {
    it("delegates to systemListsService.createItem with user id", async () => {
      const mockItem = { id: "1", key: "shoes", labelAr: "أحذية", isActive: true };
      service.createItem.mockResolvedValue(mockItem as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { key: "shoes", labelAr: "أحذية" };
      const result = await controller.createItem("product_category", dto, req);

      expect(result).toEqual(mockItem);
      expect(service.createItem).toHaveBeenCalledWith("product_category", dto, "admin-1");
    });
  });

  describe("updateItem", () => {
    it("delegates to systemListsService.updateItem with user id", async () => {
      const mockItem = { id: "1", key: "shoes", labelAr: "أحذية معدلة", isActive: true };
      service.updateItem.mockResolvedValue(mockItem as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { labelAr: "أحذية معدلة" };
      const result = await controller.updateItem("1", dto, req);

      expect(result).toEqual(mockItem);
      expect(service.updateItem).toHaveBeenCalledWith("1", dto, "admin-1");
    });
  });

  describe("deactivateItem", () => {
    it("delegates to systemListsService.deactivateItem with user id", async () => {
      const mockItem = { id: "1", key: "shoes", labelAr: "أحذية", isActive: false };
      service.deactivateItem.mockResolvedValue(mockItem as any);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.deactivateItem("1", req);

      expect(result).toEqual(mockItem);
      expect(service.deactivateItem).toHaveBeenCalledWith("1", "admin-1");
    });
  });
});
