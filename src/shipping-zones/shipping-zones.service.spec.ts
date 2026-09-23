import { ConflictException, NotFoundException } from "@nestjs/common";
import { ShippingZonesService } from "./shipping-zones.service";

describe("ShippingZonesService", () => {
  function createService() {
    const prisma = {
      shippingZone: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sz-1",
            cityLabel: "القاهرة",
            price: 50.0,
            estimatedDays: 2,
            isActive: true,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    return {
      service: new ShippingZonesService(prisma as any, auditLogService as any),
      prisma,
      auditLogService,
    };
  }

  describe("findActiveZones", () => {
    it("returns active shipping zones sorted by sortOrder and cityLabel", async () => {
      const { service, prisma } = createService();
      const result = await service.findActiveZones();

      expect(result).toHaveLength(1);
      expect(prisma.shippingZone.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { cityLabel: "asc" }],
      });
    });
  });

  describe("findAllAdmin", () => {
    it("returns all shipping zones including inactive ones for admin", async () => {
      const { service, prisma } = createService();
      await service.findAllAdmin();

      expect(prisma.shippingZone.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: "asc" }, { cityLabel: "asc" }],
      });
    });
  });

  describe("create", () => {
    it("creates a shipping zone and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const newZone = {
        id: "sz-2",
        cityLabel: "الإسكندرية",
        price: 70.0,
        estimatedDays: 3,
        isActive: true,
        sortOrder: 2,
      };
      prisma.shippingZone.create.mockResolvedValue(newZone);

      const dto = {
        cityLabel: "الإسكندرية",
        price: 70.0,
        estimatedDays: 3,
        sortOrder: 2,
      };
      const created = await service.create(dto, "admin-user-1");

      expect(created).toEqual(newZone);
      expect(prisma.shippingZone.create).toHaveBeenCalledWith({
        data: {
          cityLabel: "الإسكندرية",
          price: 70.0,
          estimatedDays: 3,
          isActive: true,
          sortOrder: 2,
        },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "shipping_zone.create",
        entityType: "ShippingZone",
        entityId: "sz-2",
        changes: dto,
      });
    });

    it("throws ConflictException when cityLabel already exists (P2002)", async () => {
      const { service, prisma } = createService();
      prisma.shippingZone.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.create({ cityLabel: "القاهرة", price: 50.0 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("update", () => {
    it("updates a shipping zone and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const updatedZone = {
        id: "sz-1",
        cityLabel: "القاهرة والجيزة",
        price: 60.0,
        estimatedDays: 2,
        isActive: true,
        sortOrder: 1,
      };
      prisma.shippingZone.update.mockResolvedValue(updatedZone);

      const dto = { cityLabel: "القاهرة والجيزة", price: 60.0 };
      const result = await service.update("sz-1", dto, "admin-user-1");

      expect(result).toEqual(updatedZone);
      expect(prisma.shippingZone.update).toHaveBeenCalledWith({
        where: { id: "sz-1" },
        data: {
          cityLabel: "القاهرة والجيزة",
          price: 60.0,
        },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "shipping_zone.update",
        entityType: "ShippingZone",
        entityId: "sz-1",
        changes: dto,
      });
    });

    it("throws NotFoundException when zone is not found (P2025)", async () => {
      const { service, prisma } = createService();
      prisma.shippingZone.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.update("invalid-id", { price: 100 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ConflictException on cityLabel conflict (P2002)", async () => {
      const { service, prisma } = createService();
      prisma.shippingZone.update.mockRejectedValue({ code: "P2002" });

      await expect(
        service.update("sz-1", { cityLabel: "الإسكندرية" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("deactivate", () => {
    it("soft-deactivates a zone (isActive=false) and records an audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const deactivatedZone = {
        id: "sz-1",
        cityLabel: "القاهرة",
        price: 50.0,
        isActive: false,
      };
      prisma.shippingZone.update.mockResolvedValue(deactivatedZone);

      const result = await service.deactivate("sz-1", "admin-user-1");

      expect(result).toEqual(deactivatedZone);
      expect(prisma.shippingZone.update).toHaveBeenCalledWith({
        where: { id: "sz-1" },
        data: { isActive: false },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-user-1",
        action: "shipping_zone.deactivate",
        entityType: "ShippingZone",
        entityId: "sz-1",
        changes: { isActive: false },
      });
    });

    it("throws NotFoundException when zone is not found (P2025)", async () => {
      const { service, prisma } = createService();
      prisma.shippingZone.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.deactivate("invalid-id"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
