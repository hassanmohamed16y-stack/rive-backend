import { AuditLogController } from "./audit-log.controller";

describe("AuditLogController", () => {
  it("delegates query parameters to AuditLogService.findAll", async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: "log-1", action: "user.login", entityType: "User", entityId: "u-1" }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };

    const controller = new AuditLogController(mockService as any);
    const query = { userId: "u-1", action: "login" };
    const result = await controller.findAll(query as any);

    expect(mockService.findAll).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("log-1");
  });
});
