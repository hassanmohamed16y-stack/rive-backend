import { seedDatabase } from './seed-logic';

// A minimal in-memory fake of the subset of PrismaClient used by
// seedDatabase, focused on the admin user upsert behaviour. Other calls
// (category/product/variant upserts, transactions, findMany) are stubbed out
// with no-ops since they are not the concern of this test.
function createFakePrisma(initialAdmin?: { passwordHash: string; role: string; fullName: string }) {
  const usersByEmail = new Map<string, any>();

  if (initialAdmin) {
    usersByEmail.set('admin@rive.com', {
      id: 'admin-id',
      email: 'admin@rive.com',
      ...initialAdmin,
    });
  }

  return {
    user: {
      findUnique: jest.fn(async ({ where: { email } }: any) => usersByEmail.get(email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const created = { id: 'admin-id', ...data };
        usersByEmail.set(data.email, created);
        return created;
      }),
    },
    category: {
      upsert: jest.fn(async ({ create }: any) => ({ id: `cat-${create.slug}`, ...create })),
    },
    product: {
      upsert: jest.fn(async ({ create }: any) => ({ id: `prod-${create.slug}`, ...create })),
    },
    productImage: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    productVariant: {
      upsert: jest.fn(async ({ create }: any) => ({ id: `var-${create.sku}`, ...create })),
      findMany: jest.fn(async () => []),
      delete: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (actions: any[]) => Promise.all(actions)),
  };
}

describe('seedDatabase (admin password preservation)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not modify the admin passwordHash when the admin already exists', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'original-admin-password';
    const customHash = 'a-custom-hash-set-via-change-password-endpoint';
    const prisma = createFakePrisma({ passwordHash: customHash, role: 'ADMIN', fullName: 'RIVÉ Admin' });

    await seedDatabase(prisma as any);

    const admin = await prisma.user.findUnique({ where: { email: 'admin@rive.com' } });
    expect(admin.passwordHash).toBe(customHash);
    expect(admin.passwordHash).not.toBe('original-admin-password');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('running seedDatabase twice keeps a customized passwordHash unchanged on the second run', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'ADMIN_INITIAL_PASSWORD';
    const prisma = createFakePrisma();

    // First run creates the admin with the initial password's hash.
    await seedDatabase(prisma as any);
    const afterFirstRun = await prisma.user.findUnique({ where: { email: 'admin@rive.com' } });
    expect(afterFirstRun).toBeTruthy();

    // Simulate the admin changing their password via
    // POST /api/v1/auth/change-password after the first seed run.
    afterFirstRun.passwordHash = 'password-set-after-change-password-endpoint';

    // Second run (e.g. another deploy, or another call to the seed script)
    // must not reset the passwordHash back to ADMIN_INITIAL_PASSWORD.
    await seedDatabase(prisma as any);
    const afterSecondRun = await prisma.user.findUnique({ where: { email: 'admin@rive.com' } });

    expect(afterSecondRun.passwordHash).toBe('password-set-after-change-password-endpoint');
  });
});
