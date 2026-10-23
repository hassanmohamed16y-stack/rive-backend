import { isFirstSeedRun, seedDatabase } from "../../prisma/seed-logic";

/**
 * A prisma stub where any model method that is not explicitly provided throws,
 * so the test fails if the seed touches data it should leave alone.
 */
function prismaStub(roleCount: number) {
  const calls: string[] = [];
  const allowed: Record<string, Record<string, jest.Mock>> = {
    role: {
      count: jest.fn().mockResolvedValue(roleCount),
      upsert: jest.fn(async ({ where }) => ({ id: `role-${where.name}` })),
    },
    permission: {
      upsert: jest.fn(async ({ where }) => ({ id: `perm-${where.key}` })),
    },
    rolePermission: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = new Proxy(
    {},
    {
      get(_t, model: string) {
        return new Proxy(
          {},
          {
            get(_m, method: string) {
              calls.push(`${model}.${method}`);
              const fn = allowed[model]?.[method];
              if (!fn) throw new Error(`unexpected call ${model}.${method}`);
              return fn;
            },
          },
        );
      },
    },
  );
  return { prisma: prisma as any, allowed, calls };
}

describe("seed on an existing database", () => {
  const original = process.env.SEED_FORCE;
  afterEach(() => {
    if (original === undefined) delete process.env.SEED_FORCE;
    else process.env.SEED_FORCE = original;
  });

  it("detects a first run only when there are no roles", async () => {
    delete process.env.SEED_FORCE;
    expect(await isFirstSeedRun(prismaStub(0).prisma)).toBe(true);
    expect(await isFirstSeedRun(prismaStub(3).prisma)).toBe(false);
  });

  it("SEED_FORCE=true forces a full seed", async () => {
    process.env.SEED_FORCE = "true";
    expect(await isFirstSeedRun(prismaStub(3).prisma)).toBe(true);
  });

  it("only syncs permissions and full_admin, and never re-inserts deleted data or accounts", async () => {
    delete process.env.SEED_FORCE;
    const { prisma, allowed, calls } = prismaStub(3);

    await seedDatabase(prisma);

    const roleNames = allowed.role.upsert.mock.calls.map(([a]) => a.where.name);
    expect(roleNames).toEqual(["full_admin"]);
    expect(calls.some((c) => c.startsWith("shippingZone."))).toBe(false);
    expect(calls.some((c) => c.startsWith("category."))).toBe(false);
    expect(calls).not.toContain("user.create");
  });
});
