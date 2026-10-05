import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AdminCartSessionsController } from "./admin-cart-sessions.controller";
import { CartSessionsService } from "./cart-sessions.service";
import { AbandonedCartsQueryDto } from "./dto/abandoned-carts-query.dto";

describe("AdminCartSessionsController", () => {
  let controller: AdminCartSessionsController;
  let cartSessionsService: jest.Mocked<CartSessionsService>;
  let pipe: ValidationPipe;

  beforeEach(async () => {
    const mockCartSessionsService = {
      getAbandonedCarts: jest.fn(),
      syncCart: jest.fn(),
      getCart: jest.fn(),
      clearCart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCartSessionsController],
      providers: [
        { provide: CartSessionsService, useValue: mockCartSessionsService },
      ],
    }).compile();

    controller = module.get<AdminCartSessionsController>(
      AdminCartSessionsController,
    );
    cartSessionsService = module.get(CartSessionsService);

    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Validation & DTO transformation", () => {
    it("accepts a valid numeric inactivityMinutes value", async () => {
      const target = await pipe.transform(
        { inactivityMinutes: "60", page: "2", limit: "10" },
        { type: "query", metatype: AbandonedCartsQueryDto },
      );

      expect(target).toBeInstanceOf(AbandonedCartsQueryDto);
      expect(target.inactivityMinutes).toBe(60);
      expect(target.page).toBe(2);
      expect(target.limit).toBe(10);
    });

    it("defaults inactivityMinutes to 30 when parameter is omitted", async () => {
      const target = await pipe.transform(
        {},
        { type: "query", metatype: AbandonedCartsQueryDto },
      );

      expect(target).toBeInstanceOf(AbandonedCartsQueryDto);
      expect(target.inactivityMinutes).toBe(30);
    });

    it("rejects non-numeric inactivityMinutes with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { inactivityMinutes: "abc" },
          { type: "query", metatype: AbandonedCartsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects negative inactivityMinutes with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { inactivityMinutes: "-5" },
          { type: "query", metatype: AbandonedCartsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects zero inactivityMinutes with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { inactivityMinutes: "0" },
          { type: "query", metatype: AbandonedCartsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects inactivityMinutes greater than max limit (43200) with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { inactivityMinutes: "43201" },
          { type: "query", metatype: AbandonedCartsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects non-integer inactivityMinutes with 400 Bad Request", async () => {
      await expect(
        pipe.transform(
          { inactivityMinutes: "12.5" },
          { type: "query", metatype: AbandonedCartsQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getAbandoned", () => {
    it("delegates to cartSessionsService.getAbandonedCarts with query parameters", async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      cartSessionsService.getAbandonedCarts.mockResolvedValue(
        mockResult as any,
      );

      const queryDto = new AbandonedCartsQueryDto();
      queryDto.inactivityMinutes = 45;
      queryDto.page = 1;
      queryDto.limit = 20;

      const result = await controller.getAbandoned(queryDto);

      expect(cartSessionsService.getAbandonedCarts).toHaveBeenCalledWith(45, {
        page: 1,
        limit: 20,
      });
      expect(result).toBe(mockResult);
    });

    it("uses default 30 minutes when inactivityMinutes is not set", async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      cartSessionsService.getAbandonedCarts.mockResolvedValue(
        mockResult as any,
      );

      const queryDto = new AbandonedCartsQueryDto();

      await controller.getAbandoned(queryDto);

      expect(cartSessionsService.getAbandonedCarts).toHaveBeenCalledWith(30, {
        page: 1,
        limit: 20,
      });
    });
  });
});
