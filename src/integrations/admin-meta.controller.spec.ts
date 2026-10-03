import { Test, TestingModule } from "@nestjs/testing";
import { AdminMetaController } from "./admin-meta.controller";
import { MetaService } from "./meta.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { SendMetaMessageDto } from "./dto/send-meta-message.dto";

describe("AdminMetaController", () => {
  let controller: AdminMetaController;
  let metaService: any;

  beforeEach(async () => {
    metaService = {
      findAllConversations: jest.fn(),
      findConversationMessages: jest.fn(),
      sendReply: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMetaController],
      providers: [{ provide: MetaService, useValue: metaService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminMetaController>(AdminMetaController);
  });

  it("should delegate sendReply call to metaService.sendReply with conversation id, text, and user id", async () => {
    const dto: SendMetaMessageDto = { text: "Hello customer" };
    const req: any = { user: { id: "admin-123" } };
    metaService.sendReply.mockResolvedValue({ id: "msg-1", text: dto.text });

    const result = await controller.sendReply("conv-1", dto, req);

    expect(metaService.sendReply).toHaveBeenCalledWith("conv-1", "Hello customer", "admin-123");
    expect(result).toEqual({ id: "msg-1", text: dto.text });
  });
});
