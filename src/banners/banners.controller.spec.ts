import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RolesGuard } from "../auth/roles.guard";
import { BannersController } from "./banners.controller";
import { BannersService } from "./banners.service";

describe("BannersController", () => {
  let controller: BannersController;
  let service: jest.Mocked<BannersService>;

  beforeEach(async () => {
    const mockService = {
      findActive: jest.fn(),
      findAllAdmin: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BannersController],
      providers: [{ provide: BannersService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BannersController>(BannersController);
    service = module.get(BannersService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findActive", () => {
    it("delegates to bannersService.findActive", async () => {
      const mockBanners = [{ id: "1", titleAr: "شعار نشط" }];
      service.findActive.mockResolvedValue(mockBanners as any);

      const result = await controller.findActive();

      expect(result).toEqual(mockBanners);
      expect(service.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAllAdmin", () => {
    it("delegates to bannersService.findAllAdmin", async () => {
      const mockBanners = [
        { id: "1", titleAr: "شعار 1" },
        { id: "2", titleAr: "شعار 2" },
      ];
      service.findAllAdmin.mockResolvedValue(mockBanners as any);

      const result = await controller.findAllAdmin();

      expect(result).toEqual(mockBanners);
      expect(service.findAllAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("delegates to bannersService.create with dto, file, and req user id", async () => {
      const mockBanner = { id: "1", titleAr: "شعار جديد" };
      service.create.mockResolvedValue(mockBanner as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = {
        titleAr: "شعار جديد",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
      };
      const file = { buffer: Buffer.from("img") } as any;

      const result = await controller.create(dto, file, req);

      expect(result).toEqual(mockBanner);
      expect(service.create).toHaveBeenCalledWith(dto, file, "admin-1");
    });
  });

  describe("update", () => {
    it("delegates to bannersService.update with id, dto, file, and req user id", async () => {
      const mockBanner = { id: "1", titleAr: "شعار معدل" };
      service.update.mockResolvedValue(mockBanner as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { titleAr: "شعار معدل" };
      const file = undefined;

      const result = await controller.update("1", dto, file, req);

      expect(result).toEqual(mockBanner);
      expect(service.update).toHaveBeenCalledWith("1", dto, file, "admin-1");
    });
  });

  describe("delete", () => {
    it("delegates to bannersService.delete with id and req user id", async () => {
      service.delete.mockResolvedValue({ success: true } as any);

      const req = { user: { id: "admin-1" } } as any;
      const result = await controller.delete("1", req);

      expect(result).toEqual({ success: true });
      expect(service.delete).toHaveBeenCalledWith("1", "admin-1");
    });
  });
});
