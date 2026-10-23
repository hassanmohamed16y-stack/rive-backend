import { BadRequestException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UsersService } from "./users.service";

jest.mock("bcrypt", () => ({
  hash: jest.fn(async () => "hashed"),
}));

describe("UsersService.createUser", () => {
  function setup() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: "u1", ...data })),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: "r1" }) },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new UsersService(prisma as any, audit as any),
      prisma,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it("creates a staff user from a username only, with an internal placeholder email", async () => {
    const { service, prisma } = setup();
    const result: any = await service.createUser(
      {
        name: "Sara",
        username: "Cashier1",
        password: "Passw0rd!",
        roleId: "r1",
      },
      "admin-1",
    );

    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      username: "cashier1",
      email: expect.stringMatching(/@staff\.rive\.invalid$/),
      roleId: "r1",
      role: "ADMIN",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(bcrypt.hash).toHaveBeenCalled();
  });

  it("accepts a person's name with spaces as the username", async () => {
    const { service, prisma } = setup();
    await service.createUser(
      {
        name: "حسن محمد",
        username: "  حسن   محمد ",
        password: "Passw0rd!",
        roleId: "r1",
      },
      "admin-1",
    );
    expect(prisma.user.create.mock.calls[0][0].data.username).toBe("حسن محمد");
  });

  it("requires an email or a username", async () => {
    const { service } = setup();
    await expect(
      service.createUser({ name: "Sara", password: "Passw0rd!" }, "admin-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a username that is already taken", async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce({ id: "other" }); // username lookup
    await expect(
      service.createUser(
        { name: "Sara", username: "cashier1", password: "Passw0rd!" },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("UsersService staff-only scope", () => {
  function setup(target: any) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(target),
        update: jest.fn(),
      },
      role: { findUnique: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new UsersService(prisma as any, audit as any), prisma };
  }

  it("lists only staff accounts, never customers", async () => {
    const { service, prisma } = setup(null);
    await service.findAllUsers({ page: 1, limit: 20 }, "sara");
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      OR: [{ role: "ADMIN" }, { roleId: { not: null } }],
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });

  it("refuses to edit or disable a customer account from the staff screen", async () => {
    const customer = {
      id: "c1",
      role: "CUSTOMER",
      roleId: null,
      isActive: true,
    };
    const { service, prisma } = setup(customer);
    await expect(
      service.updateUser("c1", { roleId: "r1" } as any, { id: "admin-1" }),
    ).rejects.toThrow("not found");
    await expect(service.disableUser("c1", { id: "admin-1" })).rejects.toThrow(
      "not found",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("UsersService.disableUser", () => {
  it("only marks the staff account inactive so it stays listed and can be re-enabled", async () => {
    const staff = {
      id: "s1",
      role: "ADMIN",
      roleId: "r2",
      isActive: true,
      roleRecord: { name: "sales" },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(staff),
        update: jest.fn().mockResolvedValue({ ...staff, isActive: false }),
      },
    };
    const service = new UsersService(
      prisma as any,
      { record: jest.fn() } as any,
    );

    await service.disableUser("s1", { id: "admin-1" });

    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      isActive: false,
    });
  });
});
