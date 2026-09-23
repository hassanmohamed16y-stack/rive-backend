import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RolesGuard } from "../auth/roles.guard";
import { ShippingZonesController } from "./shipping-zones.controller";
import { ShippingZonesService } from "./shipping-zones.service";

describe("ShippingZonesController", () => {
  let controller: ShippingZonesController;
  let service: jest.Mocked<ShippingZonesService>;

  beforeEach(async () => {
    const mockService = {
      findActiveZones: jest.fn(),
      findAllAdmin: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingZonesController],
      providers: [{ provide: ShippingZonesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ShippingZonesController>(ShippingZonesController);
    service = module.get(ShippingZonesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findActive", () => {
    it("delegates to shippingZonesService.findActiveZones", async () => {
      const mockZones = [{ id: "1", cityLabel: "القاهرة", price: 50, estimatedDays: 2, isActive: true }];
      service.findActiveZones.mockResolvedValue(mockZones as any);

      const result = await controller.findActive();

      expect(result).toEqual(mockZones);
      expect(service.findActiveZones).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAllAdmin", () => {
    it("delegates to shippingZonesService.findAllAdmin", async () => {
      const mockZones = [
        { id: "1", cityLabel: "القاهرة", price: 50, estimatedDays: 2, isActive: true },
        { id: "2", cityLabel: "طرطوس", price: 100, estimatedDays: 5, isActive: false },
      ];
      service.findAllAdmin.mockResolvedValue(mockZones as any);

      const result = await controller.findAllAdmin();

      expect(result).toEqual(mockZones);
      expect(service.findAllAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("delegates to shippingZonesService.create with user id", async () => {
      const mockZone = { id: "1", cityLabel: "الجيزة", price: 50, estimatedDays: 2, isActive: true };
      service.create.mockResolvedValue(mockZone as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { cityLabel: "الجيزة", price: 50, estimatedDays: 2 };
      const result = await controller.create(dto, req);

      expect(result).toEqual(mockZone);
      expect(service.create).toHaveBeenCalledWith(dto, "admin-1");
    });
  });

  describe("update", () => {
    it("delegates to shippingZonesService.update with user id", async () => {
      const mockZone = { id: "1", cityLabel: "القاهرة والجيزة", price: 60, estimatedDays: 2, isActive: true };
      service.update.mockResolvedValue(mockZone as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { cityLabel: "القاهرة والجيزة", price: 60 };
      const result = await controller.update("1", dto, req);

      expect(result).toEqual(mockZone);
      expect(service.update).toHaveBeenCalledWith("1", dto, "admin-1");
    });
  });

  describe("deactivate", () => {
    it("delegates to shippingZonesService.deactivate with user id", async () => {
      const mockZone = { id: "1", cityLabel: "القاهرة", price: 50, isActive: false };
      service.deactivate.mockResolvedValue(mockZone as any);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.deactivate("1", req);

      expect(result).toEqual(mockZone);
      expect(service.deactivate).toHaveBeenCalledWith("1", "admin-1");
    });
  });
});
