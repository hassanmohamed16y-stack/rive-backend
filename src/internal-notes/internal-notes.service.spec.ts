import { Test, TestingModule } from "@nestjs/testing";
import { InternalNotesService } from "./internal-notes.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotFoundException } from "@nestjs/common";

describe("InternalNotesService", () => {
  let service: InternalNotesService;
  let prisma: any;
  let auditLogService: any;

  beforeEach(async () => {
    prisma = {
      internalNote: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    auditLogService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<InternalNotesService>(InternalNotesService);
  });

  it("creates an internal note and records audit log", async () => {
    const mockNote = {
      id: "note_1",
      content: "Important customer note",
      entityType: "Order",
      entityId: "ord_100",
      createdById: "user_1",
    };
    prisma.internalNote.create.mockResolvedValue(mockNote);

    const result = await service.create(
      {
        content: "Important customer note",
        entityType: "Order",
        entityId: "ord_100",
      },
      "user_1",
    );

    expect(prisma.internalNote.create).toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith({
      userId: "user_1",
      action: "internal_note.create",
      entityType: "Order",
      entityId: "ord_100",
      changes: {
        content: "Important customer note",
        entityType: "Order",
        entityId: "ord_100",
      },
    });
    expect(result).toEqual(mockNote);
  });

  it("lists internal notes filtered by entityType and entityId", async () => {
    const mockNotes = [{ id: "note_1", content: "Note 1" }];
    prisma.internalNote.findMany.mockResolvedValue(mockNotes);

    const result = await service.findAll("Order", "ord_100");

    expect(prisma.internalNote.findMany).toHaveBeenCalledWith({
      where: { entityType: "Order", entityId: "ord_100" },
      include: expect.any(Object),
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual(mockNotes);
  });

  it("finds a single note by ID or throws NotFoundException", async () => {
    prisma.internalNote.findUnique.mockResolvedValue(null);

    await expect(service.findOne("invalid_id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("updates an internal note", async () => {
    const existing = { id: "note_1", entityType: "Order", entityId: "ord_100" };
    prisma.internalNote.findUnique.mockResolvedValue(existing);
    prisma.internalNote.update.mockResolvedValue({
      ...existing,
      content: "Updated content",
    });

    const result = await service.update("note_1", { content: "Updated content" }, "user_1");

    expect(result.content).toBe("Updated content");
  });

  it("deletes an internal note", async () => {
    const existing = { id: "note_1", entityType: "Order", entityId: "ord_100" };
    prisma.internalNote.findUnique.mockResolvedValue(existing);
    prisma.internalNote.delete.mockResolvedValue(existing);

    const result = await service.remove("note_1", "user_1");

    expect(result).toEqual({ success: true });
  });
});
