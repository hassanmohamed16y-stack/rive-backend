const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Checking for legacy archived products...");

    // Find products that currently have status = 'ARCHIVED' and deletedAt is NULL
    const legacyArchivedProducts = await prisma.product.findMany({
      where: {
        status: "ARCHIVED",
        deletedAt: null,
      },
    });

    console.log(
      `Found ${legacyArchivedProducts.length} product(s) with status = 'ARCHIVED' and deletedAt = null.`,
    );

    if (legacyArchivedProducts.length > 0) {
      const now = new Date();
      for (const product of legacyArchivedProducts) {
        console.log(`Migrating product ID ${product.id} ("${product.name}")...`);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            deletedAt: now,
            status: "ACTIVE",
          },
        });
      }
      console.log("Legacy archived products successfully migrated!");
    } else {
      console.log("No legacy archived products needed migration.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
