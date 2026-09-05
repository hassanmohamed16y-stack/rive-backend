import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seed-logic';

const prisma = new PrismaClient();

seedDatabase(prisma)
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
