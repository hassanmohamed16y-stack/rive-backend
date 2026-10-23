import { RolesService } from "./roles.service";

describe("RolesService.findAllRoles user count", () => {
  it("returns how many active users hold each role", async () => {
    const prisma: any = {
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "r1",
            name: "full_admin",
            label: "مدير عام",
            createdAt: new Date(),
            _count: { users: 1 },
            permissions: [],
          },
        ]),
      },
    };
    const service = new (RolesService as any)(prisma, { record: jest.fn() });

    const [role] = await service.findAllRoles();

    expect(role.userCount).toBe(1);
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { users: { where: { deletedAt: null } } } },
        }),
      }),
    );
  });
});
