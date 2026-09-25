import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  let service: ReviewsService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  it("should create a pending review for a valid product", async () => {
    mockPrismaService.product.findUnique.mockResolvedValue({ id: "p1" });
    mockPrismaService.review.create.mockResolvedValue({
      id: "r1",
      productId: "p1",
      rating: 5,
      isApproved: false,
    });

    const res = await service.createReview("p1", { rating: 5, comment: "Loved it" });
    expect(res.isApproved).toBe(false);
  });
});
