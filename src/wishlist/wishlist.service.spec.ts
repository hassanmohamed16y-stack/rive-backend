import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { WishlistService } from "./wishlist.service";

describe("WishlistService", () => {
  let service: WishlistService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    wishlistItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    jest.clearAllMocks();
  });

  it("should add a product to user wishlist", async () => {
    mockPrismaService.product.findUnique.mockResolvedValue({ id: "p1" });
    mockPrismaService.wishlistItem.create.mockResolvedValue({
      id: "w1",
      customerId: "u1",
      productId: "p1",
    });

    const res = await service.addToWishlist("u1", "p1");
    expect(res.productId).toBe("p1");
  });
});
