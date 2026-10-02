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
      findUnique: jest.Mock;
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
    refreshToken: {
      deleteMany: jest.Mock;
    };
  };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
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
      refreshToken: {
        deleteMany: jest.fn(),
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
    it("creates deletion request for customer", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: UserRole.CUSTOMER });
      prisma.dataDeletionRequest.findFirst.mockResolvedValue(null);
      prisma.dataDeletionRequest.create.mockResolvedValue({ id: "req-1", userId: "u1", status: DeletionRequestStatus.PENDING });

      const res = await service.createDeletionRequest("u1", { reason: "Moving away" });
      expect(res.id).toBe("req-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "customer.data_deletion.request" }),
      );
    });

    it("refuses creating deletion request for non-customer user", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: UserRole.ADMIN });

      await expect(
        service.createDeletionRequest("admin-1", { reason: "Test" }),
      ).rejects.toThrow("Data deletion requests can only be created by customers");
    });

    it("refuses approval if customer has active orders", async () => {
      prisma.dataDeletionRequest.findUnique.mockResolvedValue({
        id: "req-1",
        userId: "u1",
        user: { id: "u1", role: UserRole.CUSTOMER },
        status: DeletionRequestStatus.PENDING,
      });
      prisma.order.count.mockResolvedValue(1);

      await expect(
        service.approveDeletionRequest("req-1", "admin-1"),
      ).rejects.toThrow(/Cannot approve data deletion request for a customer with active orders/);
    });

    it("refuses approval if user is not a customer", async () => {
      prisma.dataDeletionRequest.findUnique.mockResolvedValue({
        id: "req-1",
        userId: "admin-1",
        user: { id: "admin-1", role: UserRole.ADMIN },
        status: DeletionRequestStatus.PENDING,
      });

      await expect(
        service.approveDeletionRequest("req-1", "admin-1"),
      ).rejects.toThrow("Only customer data deletion requests can be approved");
    });

    it("approves deletion request and anonymizes customer PII & linked models inside transaction", async () => {
      const mockUser = { id: "u1", role: UserRole.CUSTOMER };
      prisma.dataDeletionRequest.findUnique.mockResolvedValue({
        id: "req-1",
        userId: "u1",
        user: mockUser,
        status: DeletionRequestStatus.PENDING,
      });
      prisma.order.count.mockResolvedValue(0);

      const txUserUpdate = jest.fn().mockResolvedValue({ id: "u1" });
      const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
      const txRefreshTokenDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txWishlistDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCartSessionDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txReviewUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txReferralCodeDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txInternalNoteUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txInternalNoteDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txMetaConversationUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txDataDeletionRequestUpdate = jest.fn().mockResolvedValue({
        id: "req-1",
        status: DeletionRequestStatus.APPROVED,
      });

      const txMock = {
        user: { update: txUserUpdate },
        order: { updateMany: txOrderUpdateMany },
        refreshToken: { deleteMany: txRefreshTokenDeleteMany },
        wishlistItem: { deleteMany: txWishlistDeleteMany },
        cartSession: { deleteMany: txCartSessionDeleteMany },
        review: { updateMany: txReviewUpdateMany },
        referralCode: { deleteMany: txReferralCodeDeleteMany },
        internalNote: { updateMany: txInternalNoteUpdateMany, deleteMany: txInternalNoteDeleteMany },
        metaConversation: { updateMany: txMetaConversationUpdateMany },
        dataDeletionRequest: { update: txDataDeletionRequestUpdate },
      };

      (prisma as any).$transaction = jest.fn(async (cb: any) => cb(txMock));

      const res = await service.approveDeletionRequest("req-1", "admin-1");

      expect(res.status).toBe(DeletionRequestStatus.APPROVED);

      expect(txUserUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: expect.objectContaining({
          fullName: "Anonymized User",
          email: "anonymized_u1@deleted.local",
          isActive: false,
        }),
      });

      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        data: expect.objectContaining({
          customerName: "Anonymized Customer",
          customerEmail: "anonymized_u1@deleted.local",
          shippingAddress: "Anonymized Address",
        }),
      });

      expect(txRefreshTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
      expect(txWishlistDeleteMany).toHaveBeenCalledWith({ where: { customerId: "u1" } });
      expect(txCartSessionDeleteMany).toHaveBeenCalledWith({ where: { customerId: "u1" } });
      expect(txReviewUpdateMany).toHaveBeenCalledWith({
        where: { customerId: "u1" },
        data: { customerId: null, authorName: "Anonymized User" },
      });
      expect(txReferralCodeDeleteMany).toHaveBeenCalledWith({ where: { customerId: "u1" } });
      expect(txInternalNoteUpdateMany).toHaveBeenCalledWith({
        where: { createdById: "u1" },
        data: { createdById: null },
      });
      expect(txInternalNoteDeleteMany).toHaveBeenCalledWith({
        where: { entityType: "User", entityId: "u1" },
      });
      expect(txMetaConversationUpdateMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        data: { userId: null, customerName: "Anonymized Customer", customerEmail: null },
      });
    });

    it("rejects deletion request with admin notes", async () => {
      prisma.dataDeletionRequest.findUnique.mockResolvedValue({
        id: "req-1",
        status: DeletionRequestStatus.PENDING,
      });
      prisma.dataDeletionRequest.update.mockResolvedValue({
        id: "req-1",
        status: DeletionRequestStatus.REJECTED,
        adminNotes: "Active fraud dispute",
      });

      const res = await service.rejectDeletionRequest("req-1", { adminNotes: "Active fraud dispute" }, "admin-1");

      expect(res.status).toBe(DeletionRequestStatus.REJECTED);
      expect(prisma.dataDeletionRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: expect.objectContaining({
          status: DeletionRequestStatus.REJECTED,
          adminNotes: "Active fraud dispute",
        }),
      });
    });
  });

  describe("blockCustomer", () => {
    it("blocks customer and revokes refresh tokens", async () => {
      const mockUser = { id: "cust-1", role: UserRole.CUSTOMER, fullName: "Alice Smith", email: "alice@example.com", createdAt: new Date(), orders: [] };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, isBlocked: true, isActive: false });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.blockCustomer("cust-1", "admin-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: { isBlocked: true, isActive: false },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "cust-1" } });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "customer.block",
        entityType: "User",
        entityId: "cust-1",
        changes: { isBlocked: true, isActive: false },
      });
      expect(result.id).toBe("cust-1");
    });

    it("throws BadRequestException if target user is ADMIN or staff", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: UserRole.ADMIN });

      await expect(service.blockCustomer("admin-1", "admin-actor")).rejects.toThrow(
        "Admins or staff accounts cannot be blocked or deleted",
      );
    });

    it("throws NotFoundException if customer is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.blockCustomer("missing", "admin-actor")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("unblockCustomer", () => {
    it("unblocks customer", async () => {
      const mockUser = { id: "cust-1", role: UserRole.CUSTOMER, fullName: "Alice Smith", email: "alice@example.com", createdAt: new Date(), orders: [] };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, isBlocked: false, isActive: true });

      const result = await service.unblockCustomer("cust-1", "admin-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: { isBlocked: false, isActive: true },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "customer.unblock",
        entityType: "User",
        entityId: "cust-1",
        changes: { isBlocked: false, isActive: true },
      });
      expect(result.id).toBe("cust-1");
    });

    it("throws BadRequestException if target user is ADMIN or staff", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: UserRole.ADMIN });

      await expect(service.unblockCustomer("admin-1", "admin-actor")).rejects.toThrow(
        "Admins or staff accounts cannot be blocked or deleted",
      );
    });
  });

  describe("deleteCustomer", () => {
    it("anonymizes customer data, revokes refresh tokens and audits action", async () => {
      const mockUser = {
        id: "cust-1",
        role: UserRole.CUSTOMER,
        fullName: "Alice Smith",
        email: "alice@example.com",
        createdAt: new Date(),
        orders: [],
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const txUserUpdate = jest.fn().mockResolvedValue({ id: "cust-1" });
      const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const txRefreshTokenDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txWishlistDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      const txCartSessionDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      const txReviewUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const txReferralCodeDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      const txInternalNoteUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const txInternalNoteDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
      const txMetaConversationUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

      const txMock = {
        user: { update: txUserUpdate },
        order: { updateMany: txOrderUpdateMany },
        refreshToken: { deleteMany: txRefreshTokenDeleteMany },
        wishlistItem: { deleteMany: txWishlistDeleteMany },
        cartSession: { deleteMany: txCartSessionDeleteMany },
        review: { updateMany: txReviewUpdateMany },
        referralCode: { deleteMany: txReferralCodeDeleteMany },
        internalNote: { updateMany: txInternalNoteUpdateMany, deleteMany: txInternalNoteDeleteMany },
        metaConversation: { updateMany: txMetaConversationUpdateMany },
      };

      (prisma as any).$transaction = jest.fn(async (cb: any) => cb(txMock));

      const result = await service.deleteCustomer("cust-1", "admin-1");

      expect(txUserUpdate).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: expect.objectContaining({
          fullName: "Anonymized User",
          email: "anonymized_cust-1@deleted.local",
          isActive: false,
        }),
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "customer.delete",
        entityType: "User",
        entityId: "cust-1",
        changes: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(result.name).toBe("Anonymized User");
      expect(result.email).toBe("anonymized_cust-1@deleted.local");
    });

    it("throws BadRequestException if target user is ADMIN or staff", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "admin-1", role: UserRole.ADMIN });

      await expect(service.deleteCustomer("admin-1", "admin-actor")).rejects.toThrow(
        "Admins or staff accounts cannot be blocked or deleted",
      );
    });
  });
});
