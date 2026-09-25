import { Test, TestingModule } from "@nestjs/testing";
import { InternalNotesController } from "./internal-notes.controller";
import { InternalNotesService } from "./internal-notes.service";

describe("InternalNotesController", () => {
  let controller: InternalNotesController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalNotesController],
      providers: [{ provide: InternalNotesService, useValue: service }],
    }).compile();

    controller = module.get<InternalNotesController>(InternalNotesController);
  });

  it("creates a note", async () => {
    service.create.mockResolvedValue({ id: "note_1" });
    const req = { user: { id: "admin_1" } } as any;

    const res = await controller.create(
      { content: "Test note", entityType: "Order", entityId: "123" },
      req,
    );

    expect(service.create).toHaveBeenCalledWith(
      { content: "Test note", entityType: "Order", entityId: "123" },
      "admin_1",
    );
    expect(res).toEqual({ id: "note_1" });
  });

  it("lists notes", async () => {
    service.findAll.mockResolvedValue([]);
    const res = await controller.findAll("Order", "123");
    expect(service.findAll).toHaveBeenCalledWith("Order", "123");
    expect(res).toEqual([]);
  });
});
