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
      { name: "Sara", username: "Cashier1", password: "Passw0rd!", roleId: "r1" },
      "admin-1",
    );

    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      username: "cashier1",
      email: "cashier1@staff.rive.invalid",
      roleId: "r1",
      role: "ADMIN",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(bcrypt.hash).toHaveBeenCalled();
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
