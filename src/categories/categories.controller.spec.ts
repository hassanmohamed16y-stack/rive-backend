import { Test, TestingModule } from "@nestjs/testing";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { ListCategoriesQueryDto } from "./dto/list-categories-query.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

describe("CategoriesController", () => {
  let controller: CategoriesController;
  let categoriesService: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const mockCategoriesService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    categoriesService = module.get(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("returns categories with mapped productCount", async () => {
      const mockResult = {
        data: [
          {
            id: "cat-1",
            name: "Handbags",
            slug: "handbags",
            isFeatured: true,
            _count: { products: 5 },
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      categoriesService.findAll.mockResolvedValue(mockResult as any);

      const query: ListCategoriesQueryDto = {
        isFeatured: "true",
        page: 1,
        limit: 20,
      };
      const res = await controller.findAll(query);

      expect(categoriesService.findAll).toHaveBeenCalledWith(
        { isFeatured: "true" },
        { page: 1, limit: 20 },
      );
      expect(res).toEqual({
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        data: [
          {
            id: "cat-1",
            name: "Handbags",
            slug: "handbags",
            isFeatured: true,
            _count: { products: 5 },
            productCount: 5,
          },
        ],
      });
    });
  });

  describe("create", () => {
    it("creates a category with the authenticated user ID", async () => {
      const dto: CreateCategoryDto = { name: "Jewelry", slug: "jewelry" };
      const req = { user: { id: "admin-123", role: "ADMIN" } } as any;

      const createdCat = { id: "cat-2", name: "Jewelry", slug: "jewelry" };
      categoriesService.create.mockResolvedValue(createdCat as any);

      const res = await controller.create(dto, req);

      expect(categoriesService.create).toHaveBeenCalledWith(dto, "admin-123");
      expect(res).toBe(createdCat);
    });
  });

  describe("update", () => {
    it("updates a category with the authenticated user ID", async () => {
      const dto: UpdateCategoryDto = { name: "Fine Jewelry" };
      const req = { user: { id: "admin-123", role: "ADMIN" } } as any;

      const updatedCat = { id: "cat-2", name: "Fine Jewelry", slug: "jewelry" };
      categoriesService.update.mockResolvedValue(updatedCat as any);

      const res = await controller.update("cat-2", dto, req);

      expect(categoriesService.update).toHaveBeenCalledWith(
        "cat-2",
        dto,
        "admin-123",
      );
      expect(res).toBe(updatedCat);
    });
  });

  describe("remove", () => {
    it("deletes a category with the authenticated user ID", async () => {
      const req = { user: { id: "admin-123", role: "ADMIN" } } as any;
      categoriesService.remove.mockResolvedValue({
        message: "Category deleted successfully",
      } as any);

      const res = await controller.remove("cat-2", req);

      expect(categoriesService.remove).toHaveBeenCalledWith(
        "cat-2",
        "admin-123",
      );
      expect(res).toEqual({ message: "Category deleted successfully" });
    });
  });
});
