import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RolesGuard } from "../auth/roles.guard";
import { StaticPagesController } from "./static-pages.controller";
import { StaticPagesService } from "./static-pages.service";

describe("StaticPagesController", () => {
  let controller: StaticPagesController;
  let service: jest.Mocked<StaticPagesService>;

  beforeEach(async () => {
    const mockService = {
      findBySlug: jest.fn(),
      findAllAdmin: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaticPagesController],
      providers: [{ provide: StaticPagesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StaticPagesController>(StaticPagesController);
    service = module.get(StaticPagesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findBySlug", () => {
    it("delegates to staticPagesService.findBySlug", async () => {
      const mockPage = { id: "1", slug: "about-us", titleAr: "من نحن", isPublished: true };
      service.findBySlug.mockResolvedValue(mockPage as any);

      const result = await controller.findBySlug("about-us");

      expect(result).toEqual(mockPage);
      expect(service.findBySlug).toHaveBeenCalledWith("about-us");
    });
  });

  describe("findAllAdmin", () => {
    it("delegates to staticPagesService.findAllAdmin", async () => {
      const mockPages = [
        { id: "1", slug: "about-us", isPublished: true },
        { id: "2", slug: "return-policy", isPublished: false },
      ];
      service.findAllAdmin.mockResolvedValue(mockPages as any);

      const result = await controller.findAllAdmin();

      expect(result).toEqual(mockPages);
      expect(service.findAllAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    it("delegates to staticPagesService.update with req.user.id", async () => {
      const mockUpdated = { id: "1", slug: "about-us", titleAr: "عنوان جديد" };
      service.update.mockResolvedValue(mockUpdated as any);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { titleAr: "عنوان جديد" };
      const result = await controller.update("1", dto, req);

      expect(result).toEqual(mockUpdated);
      expect(service.update).toHaveBeenCalledWith("1", dto, "admin-1");
    });
  });
});
