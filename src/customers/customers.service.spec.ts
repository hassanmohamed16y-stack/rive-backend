import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DeletionRequestStatus, OrderStatus, PaymentStatus, UserRole } from "@prisma/client";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  calculateCustomerTier,
  CUSTOMER_TIER_THRESHOLDS,
} from "./customers.constants";
import { CustomersService } from "./customers.service";

describe("CustomersService", () => {
  let service: CustomersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    order: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    review: {
      findMany: jest.Mock;
    };
    dataDeletionRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      review: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dataDeletionRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLogService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe("calculateCustomerTier helper", () => {
    it("returns NEW when totalSpent < 2000", () => {
      expect(calculateCustomerTier(0)).toBe("NEW");
      expect(calculateCustomerTier(1999.99)).toBe("NEW");
    });

    it("returns REGULAR when totalSpent is between 2000 and 9999.99", () => {
      expect(calculateCustomerTier(2000)).toBe("REGULAR");
      expect(calculateCustomerTier(5000)).toBe("REGULAR");
      expect(calculateCustomerTier(9999.99)).toBe("REGULAR");
    });

    it("returns VIP when totalSpent >= 10000", () => {
      expect(calculateCustomerTier(10000)).toBe("VIP");
      expect(calculateCustomerTier(50000)).toBe("VIP");
    });

    it("uses exported threshold constants correctly", () => {
      expect(CUSTOMER_TIER_THRESHOLDS.VIP).toBe(10000);
      expect(CUSTOMER_TIER_THRESHOLDS.REGULAR).toBe(2000);
      expect(CUSTOMER_TIER_THRESHOLDS.NEW).toBe(0);
    });
  });

  describe("findAll", () => {
    it("returns paginated list of customers with computed metrics", async () => {
      const mockUsers = [
        {
          id: "cust-1",
          fullName: "Alice Smith",
          email: "alice@example.com",
          role: UserRole.CUSTOMER,
          createdAt: new Date("2025-01-01"),
          orders: [
            {
              totalAmount: 2500,
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.DELIVERED,
              shippingPhone: "+201234567890",
              createdAt: new Date("2025-01-02"),
            },
          ],
        },
        {
          id: "cust-2",
          fullName: "Bob Jones",
          email: "bob@example.com",
          role: UserRole.CUSTOMER,
          createdAt: new Date("2025-01-03"),
          orders: [],
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.CUSTOMER },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: "cust-1",
        name: "Alice Smith",
        email: "alice@example.com",
        phone: "+201234567890",
        createdAt: new Date("2025-01-01"),
        ordersCount: 1,
        totalSpent: 2500,
        tier: "REGULAR",
      });
      expect(result.data[1]).toEqual({
        id: "cust-2",
        name: "Bob Jones",
        email: "bob@example.com",
        phone: null,
        createdAt: new Date("2025-01-03"),
        ordersCount: 0,
        totalSpent: 0,
        tier: "NEW",
      });
    });

    it("filters by search query on name or email", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ search: "alice", page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.CUSTOMER,
          OR: [
            { fullName: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("filters by tier query param", async () => {
      const mockUsers = [
        {
          id: "cust-vip",
          fullName: "VIP User",
          email: "vip@example.com",
          role: UserRole.CUSTOMER,
          createdAt: new Date(),
          orders: [
            {
              totalAmount: 15000,
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.DELIVERED,
              shippingPhone: "+201111111111",
              createdAt: new Date(),
            },
          ],
        },
        {
          id: "cust-new",
          fullName: "New User",
          email: "new@example.com",
          role: UserRole.CUSTOMER,
          createdAt: new Date(),
          orders: [],
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll({ tier: "VIP", page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("cust-vip");
      expect(result.data[0].tier).toBe("VIP");
      expect(result.meta.total).toBe(1);
    });
  });

  describe("findOne", () => {
    it("returns customer profile by ID when found", async () => {
      const mockUser = {
        id: "cust-1",
        fullName: "Alice Smith",
        email: "alice@example.com",
        role: UserRole.CUSTOMER,
        createdAt: new Date("2025-01-01"),
        orders: [
          {
            totalAmount: 12000,
            paymentStatus: PaymentStatus.PAID,
            status: OrderStatus.DELIVERED,
            shippingPhone: "+201234567890",
            createdAt: new Date("2025-01-02"),
          },
        ],
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne("cust-1");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: "cust-1", role: UserRole.CUSTOMER },
        include: expect.any(Object),
      });

      expect(result).toEqual({
        id: "cust-1",
        name: "Alice Smith",
        email: "alice@example.com",
        phone: "+201234567890",
        createdAt: new Date("2025-01-01"),
        ordersCount: 1,
        totalSpent: 12000,
        tier: "VIP",
      });
    });

    it("throws NotFoundException when customer is not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findByEmail", () => {
    it("returns customer profile by email when found", async () => {
      const mockUser = {
        id: "cust-1",
        fullName: "Alice Smith",
        email: "alice@example.com",
        role: UserRole.CUSTOMER,
        createdAt: new Date("2025-01-01"),
        orders: [],
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail("ALICE@EXAMPLE.COM");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "alice@example.com", role: UserRole.CUSTOMER },
        include: expect.any(Object),
      });

      expect(result.id).toBe("cust-1");
      expect(result.email).toBe("alice@example.com");
      expect(result.tier).toBe("NEW");
    });

    it("throws NotFoundException when customer email is not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findByEmail("missing@example.com")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findCustomerOrders", () => {
    it("returns paginated orders for a customer", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "cust-1",
        role: UserRole.CUSTOMER,
      });

      const mockOrders = [
        { id: "ord-1", orderNumber: "RIV-1001", totalAmount: 500 },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findCustomerOrders("cust-1", {
        page: 1,
        limit: 10,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: "cust-1" },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(result).toEqual({
        data: mockOrders,
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it("throws NotFoundException if customer ID does not exist", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findCustomerOrders("missing-cust", {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("data deletion requests", () => {
    it("creates deletion request", async () => {
      prisma.dataDeletionRequest.findFirst.mockResolvedValue(null);
      prisma.dataDeletionRequest.create.mockResolvedValue({ id: "req-1", userId: "u1", status: DeletionRequestStatus.PENDING });

      const res = await service.createDeletionRequest("u1", { reason: "Moving away" });
      expect(res.id).toBe("req-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "customer.data_deletion.request" }),
      );
    });

    it("approves deletion request and anonymizes customer PII while retaining orders", async () => {
      prisma.dataDeletionRequest.findUnique.mockResolvedValue({
        id: "req-1",
        userId: "u1",
        status: DeletionRequestStatus.PENDING,
      });
      prisma.user.update.mockResolvedValue({ id: "u1", fullName: "Anonymized User" });
      prisma.order.updateMany.mockResolvedValue({ count: 2 });
      prisma.dataDeletionRequest.update.mockResolvedValue({
        id: "req-1",
        status: DeletionRequestStatus.APPROVED,
      });

      const res = await service.approveDeletionRequest("req-1", "admin-1");

      expect(res.status).toBe(DeletionRequestStatus.APPROVED);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: expect.objectContaining({
          fullName: "Anonymized User",
          email: "anonymized_u1@deleted.local",
          isActive: false,
        }),
      });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        data: expect.objectContaining({
          customerName: "Anonymized Customer",
          customerEmail: "anonymized_u1@deleted.local",
        }),
      });
    });
  });
});
