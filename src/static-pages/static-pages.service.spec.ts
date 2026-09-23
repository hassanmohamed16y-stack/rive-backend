import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { StaticPagesService } from "./static-pages.service";

describe("StaticPagesService", () => {
  let service: StaticPagesService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const mockPrisma = {
      staticPage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockAuditLog = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaticPagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<StaticPagesService>(StaticPagesService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findBySlug", () => {
    it("returns static page when published", async () => {
      const mockPage = {
        id: "page-1",
        slug: "about-us",
        titleAr: "من نحن",
        titleEn: "About Us",
        contentAr: "محتوى",
        contentEn: "Content",
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prismaService.staticPage.findUnique as jest.Mock).mockResolvedValue(mockPage);

      const result = await service.findBySlug("about-us");

      expect(result).toEqual(mockPage);
      expect(prismaService.staticPage.findUnique).toHaveBeenCalledWith({
        where: { slug: "about-us" },
      });
    });

    it("throws NotFoundException if page does not exist", async () => {
      (prismaService.staticPage.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException if page exists but is not published", async () => {
      const mockPage = {
        id: "page-1",
        slug: "draft-page",
        titleAr: "مسودة",
        titleEn: "Draft",
        contentAr: "محتوى",
        contentEn: "Content",
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prismaService.staticPage.findUnique as jest.Mock).mockResolvedValue(mockPage);

      await expect(service.findBySlug("draft-page")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAllAdmin", () => {
    it("returns all static pages including unpublished ones", async () => {
      const mockPages = [
        { id: "1", slug: "about-us", isPublished: true },
        { id: "2", slug: "draft-page", isPublished: false },
      ];
      (prismaService.staticPage.findMany as jest.Mock).mockResolvedValue(mockPages);

      const result = await service.findAllAdmin();

      expect(result).toEqual(mockPages);
      expect(prismaService.staticPage.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("update", () => {
    it("updates page and records audit log", async () => {
      const existingPage = {
        id: "page-1",
        slug: "about-us",
        titleAr: "من نحن القديم",
        titleEn: "Old About",
        contentAr: "محتوى قديم",
        contentEn: "Old content",
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPage = {
        ...existingPage,
        titleAr: "من نحن الجديد",
        contentAr: "محتوى جديد",
        isPublished: true,
      };

      (prismaService.staticPage.findUnique as jest.Mock).mockResolvedValue(existingPage);
      (prismaService.staticPage.update as jest.Mock).mockResolvedValue(updatedPage);

      const dto = {
        titleAr: "من نحن الجديد",
        contentAr: "محتوى جديد",
        isPublished: true,
      };

      const result = await service.update("page-1", dto, "admin-123");

      expect(result).toEqual(updatedPage);
      expect(prismaService.staticPage.update).toHaveBeenCalledWith({
        where: { id: "page-1" },
        data: dto,
      });

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "admin-123",
        action: "static-page.update",
        entityType: "StaticPage",
        entityId: "page-1",
        changes: {
          before: {
            titleAr: existingPage.titleAr,
            titleEn: existingPage.titleEn,
            contentAr: existingPage.contentAr,
            contentEn: existingPage.contentEn,
            isPublished: existingPage.isPublished,
          },
          after: {
            titleAr: updatedPage.titleAr,
            titleEn: updatedPage.titleEn,
            contentAr: updatedPage.contentAr,
            contentEn: updatedPage.contentEn,
            isPublished: updatedPage.isPublished,
          },
        },
      });
    });

    it("throws NotFoundException if static page to update is missing", async () => {
      (prismaService.staticPage.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update("missing-id", { titleAr: "New Title" }, "admin-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
