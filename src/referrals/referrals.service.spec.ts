import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "./referrals.service";

describe("ReferralsService", () => {
  let service: ReferralsService;

  const mockPrismaService = {
    referralCode: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    referralReward: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    jest.clearAllMocks();
  });

  it("should generate a new code if user does not have one", async () => {
    mockPrismaService.referralCode.findFirst.mockResolvedValue(null);
    mockPrismaService.referralCode.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "ref1", ...data }),
    );

    const res = await service.getMyCode("user123");
    expect(res.code).toBeDefined();
    expect(res.customerId).toBe("user123");
  });

  it("should prevent self referral", async () => {
    mockPrismaService.referralCode.findUnique.mockResolvedValue({
      id: "ref1",
      code: "REF-1234",
      customerId: "user123",
      customer: { fullName: "Aisha" },
    });

    await expect(service.validateCode("REF-1234", "user123")).rejects.toThrow(
      BadRequestException,
    );
  });
});
