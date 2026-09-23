import { ExecutionContext } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { MessageTemplatesController } from "./message-templates.controller";
import { MessageTemplatesService } from "./message-templates.service";

describe("MessageTemplatesController", () => {
  let controller: MessageTemplatesController;
  let service: {
    findAll: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageTemplatesController],
      providers: [
        { provide: MessageTemplatesService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: "admin-1", role: "ADMIN", permissions: ["settings.manage"] };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessageTemplatesController>(MessageTemplatesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("delegates to messageTemplatesService.findAll", async () => {
      const mockResult = [{ id: "1", key: "order_confirmed" }];
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll();
      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    it("delegates to messageTemplatesService.update with admin user ID", async () => {
      const mockUpdated = { id: "tpl-1", key: "order_confirmed", bodyAr: "Updated" };
      service.update.mockResolvedValue(mockUpdated);

      const req = { user: { id: "admin-1" } } as any;
      const dto = { bodyAr: "Updated" };

      const result = await controller.update("tpl-1", dto, req);
      expect(result).toEqual(mockUpdated);
      expect(service.update).toHaveBeenCalledWith("tpl-1", dto, "admin-1");
    });
  });
});
