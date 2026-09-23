import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BannersService } from "./banners.service";

describe("BannersService", () => {
  function createService() {
    const prisma = {
      banner: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    const uploadService = {
      uploadImage: jest
        .fn()
        .mockResolvedValue({ url: "https://cloudinary.com/uploaded.jpg", public_id: "uploaded" }),
    };

    return {
      service: new BannersService(
        prisma as any,
        auditLogService as any,
        uploadService as any,
      ),
      prisma,
      auditLogService,
      uploadService,
    };
  }

  describe("findActive", () => {
    it("returns active banners within date range", async () => {
      const { service, prisma } = createService();
      const mockBanners = [
        {
          id: "banner-1",
          titleAr: "شعار 1",
          imageUrl: "https://cloudinary.com/1.jpg",
          startsAt: new Date(Date.now() - 10000),
          endsAt: new Date(Date.now() + 10000),
          sortOrder: 0,
          isActive: true,
        },
      ];
      prisma.banner.findMany.mockResolvedValue(mockBanners);

      const result = await service.findActive();

      expect(result).toEqual(mockBanners);
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gte: expect.any(Date) },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("findAllAdmin", () => {
    it("returns all banners for admin", async () => {
      const { service, prisma } = createService();
      const mockBanners = [{ id: "banner-1" }, { id: "banner-2" }];
      prisma.banner.findMany.mockResolvedValue(mockBanners);

      const result = await service.findAllAdmin();

      expect(result).toEqual(mockBanners);
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("create", () => {
    it("creates banner uploading file to Cloudinary and records audit log", async () => {
      const { service, prisma, auditLogService, uploadService } = createService();
      const mockFile = {
        buffer: Buffer.from("test"),
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 100,
      } as any;

      const createdBanner = {
        id: "banner-1",
        titleAr: "شعار جديد",
        imageUrl: "https://cloudinary.com/uploaded.jpg",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
        sortOrder: 0,
        isActive: true,
      };
      prisma.banner.create.mockResolvedValue(createdBanner);

      const dto = {
        titleAr: "شعار جديد",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
      };

      const result = await service.create(dto, mockFile, "admin-1");

      expect(uploadService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(createdBanner);
      expect(prisma.banner.create).toHaveBeenCalledWith({
        data: {
          titleAr: "شعار جديد",
          subtitleAr: undefined,
          imageUrl: "https://cloudinary.com/uploaded.jpg",
          linkUrl: undefined,
          startsAt: new Date("2025-01-01"),
          endsAt: new Date("2025-01-31"),
          sortOrder: 0,
          isActive: true,
        },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "CREATE_BANNER",
        entityType: "BANNER",
        entityId: "banner-1",
        changes: createdBanner,
      });
    });

    it("creates banner with explicit imageUrl when no file is uploaded", async () => {
      const { service, prisma, auditLogService } = createService();
      const createdBanner = {
        id: "banner-2",
        titleAr: "شعار ثاني",
        imageUrl: "https://example.com/banner2.jpg",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
        sortOrder: 1,
        isActive: true,
      };
      prisma.banner.create.mockResolvedValue(createdBanner);

      const dto = {
        titleAr: "شعار ثاني",
        imageUrl: "https://example.com/banner2.jpg",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
        sortOrder: 1,
      };

      const result = await service.create(dto, undefined, "admin-1");

      expect(result).toEqual(createdBanner);
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "CREATE_BANNER",
        entityType: "BANNER",
        entityId: "banner-2",
        changes: createdBanner,
      });
    });

    it("throws BadRequestException if neither file nor imageUrl is provided", async () => {
      const { service } = createService();
      const dto = {
        titleAr: "شعار بدون صورة",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
      };

      await expect(service.create(dto, undefined, "admin-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException if endsAt <= startsAt", async () => {
      const { service } = createService();
      const dto = {
        titleAr: "شعار بتاريخ خاطئ",
        imageUrl: "https://example.com/img.jpg",
        startsAt: new Date("2025-01-31"),
        endsAt: new Date("2025-01-01"),
      };

      await expect(service.create(dto, undefined, "admin-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("update", () => {
    it("updates banner and records audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const existingBanner = {
        id: "banner-1",
        titleAr: "شعار قديم",
        imageUrl: "https://example.com/old.jpg",
        startsAt: new Date("2025-01-01"),
        endsAt: new Date("2025-01-31"),
        sortOrder: 0,
        isActive: true,
      };
      prisma.banner.findUnique.mockResolvedValue(existingBanner);

      const updatedBanner = {
        ...existingBanner,
        titleAr: "شعار معدل",
      };
      prisma.banner.update.mockResolvedValue(updatedBanner);

      const dto = { titleAr: "شعار معدل" };
      const result = await service.update("banner-1", dto, undefined, "admin-1");

      expect(result).toEqual(updatedBanner);
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "UPDATE_BANNER",
        entityType: "BANNER",
        entityId: "banner-1",
        changes: dto,
      });
    });

    it("throws NotFoundException when banner to update does not exist", async () => {
      const { service, prisma } = createService();
      prisma.banner.findUnique.mockResolvedValue(null);

      await expect(
        service.update("invalid-id", { titleAr: "اختبار" }, undefined, "admin-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when updated endsAt <= startsAt", async () => {
      const { service, prisma } = createService();
      const existingBanner = {
        id: "banner-1",
        titleAr: "شعار",
        imageUrl: "https://example.com/old.jpg",
        startsAt: new Date("2025-01-10"),
        endsAt: new Date("2025-01-20"),
        sortOrder: 0,
        isActive: true,
      };
      prisma.banner.findUnique.mockResolvedValue(existingBanner);

      await expect(
        service.update(
          "banner-1",
          { endsAt: new Date("2025-01-05") },
          undefined,
          "admin-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("delete", () => {
    it("hard-deletes banner and records audit log", async () => {
      const { service, prisma, auditLogService } = createService();
      const existingBanner = {
        id: "banner-1",
        titleAr: "شعار محذوف",
      };
      prisma.banner.findUnique.mockResolvedValue(existingBanner);
      prisma.banner.delete.mockResolvedValue(existingBanner);

      const result = await service.delete("banner-1", "admin-1");

      expect(result).toEqual({ success: true });
      expect(prisma.banner.delete).toHaveBeenCalledWith({ where: { id: "banner-1" } });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-1",
        action: "DELETE_BANNER",
        entityType: "BANNER",
        entityId: "banner-1",
        changes: existingBanner,
      });
    });

    it("throws NotFoundException when banner to delete does not exist", async () => {
      const { service, prisma } = createService();
      prisma.banner.findUnique.mockResolvedValue(null);

      await expect(service.delete("invalid-id", "admin-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
