import { PrismaClient, ProductStatus, Size, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@rive.com' },
    update: {
      fullName: 'RIVÉ Admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
    create: {
      fullName: 'RIVÉ Admin',
      email: 'admin@rive.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const categories = [
    {
      name: 'Lingerie',
      slug: 'lingerie',
      description: 'Sheer, sculpting essentials for intimate layering.',
      isFeatured: true,
    },
    {
      name: 'Homewear',
      slug: 'homewear',
      description: 'Silky silhouettes for slow mornings and late nights.',
      isFeatured: true,
    },
    {
      name: 'Collections',
      slug: 'collections',
      description: 'Curated capsule pieces from our seasonal art direction.',
      isFeatured: false,
    },
    {
      name: 'New Arrivals',
      slug: 'new-arrivals',
      description: 'Fresh luxury pieces just introduced to the atelier edit.',
      isFeatured: true,
    },
  ];

  const createdCategories = await Promise.all(
    categories.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category,
      }),
    ),
  );

  const categoryMap = new Map(createdCategories.map((category) => [category.slug, category]));

  const products = [
    {
      name: 'Luna Silk Set',
      slug: 'luna-silk-set',
      description: 'A fluid satin set designed for an evening ritual with understated drama.',
      shortDescription: 'Silk set in deep plum with rose velvet finish.',
      price: 280,
      compareAtPrice: 360,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'lingerie',
      primaryImage: 'https://images.example.com/luna-silk-set-primary.jpg',
      images: [
        'https://images.example.com/luna-silk-set-primary.jpg',
        'https://images.example.com/luna-silk-set-detail.jpg',
        'https://images.example.com/luna-silk-set-back.jpg',
      ],
      variants: [
        { sku: 'LUNA-SILK-S', size: Size.S, colorHex: '#945958', price: 280, stock: 12 },
        { sku: 'LUNA-SILK-M', size: Size.M, colorHex: '#945958', price: 280, stock: 8 },
        { sku: 'LUNA-SILK-L', size: Size.L, colorHex: '#945958', price: 280, stock: 6 },
      ],
    },
    {
      name: 'Velvet Bloom Slip',
      slug: 'velvet-bloom-slip',
      description: 'A lightweight slip with a soft sheen and body-skimming silhouette.',
      shortDescription: 'Soft drape, couture finish, evening softness.',
      price: 240,
      compareAtPrice: 310,
      isFeatured: false,
      status: ProductStatus.ACTIVE,
      categorySlug: 'collections',
      primaryImage: 'https://images.example.com/velvet-bloom-slip-primary.jpg',
      images: [
        'https://images.example.com/velvet-bloom-slip-primary.jpg',
        'https://images.example.com/velvet-bloom-slip-front.jpg',
        'https://images.example.com/velvet-bloom-slip-back.jpg',
      ],
      variants: [
        { sku: 'VELVET-BLOOM-S', size: Size.S, colorHex: '#945958', price: 240, stock: 15 },
        { sku: 'VELVET-BLOOM-M', size: Size.M, colorHex: '#945958', price: 240, stock: 10 },
        { sku: 'VELVET-BLOOM-L', size: Size.L, colorHex: '#945958', price: 240, stock: 9 },
      ],
    },
    {
      name: 'Sienna Lounge Set',
      slug: 'sienna-lounge-set',
      description: 'Relaxed tailoring in a rich terracotta tone with a brushed matte finish.',
      shortDescription: 'Elevated comfort for slow mornings and private rituals.',
      price: 320,
      compareAtPrice: 390,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'homewear',
      primaryImage: 'https://images.example.com/sienna-lounge-set-primary.jpg',
      images: [
        'https://images.example.com/sienna-lounge-set-primary.jpg',
        'https://images.example.com/sienna-lounge-set-detail.jpg',
        'https://images.example.com/sienna-lounge-set-chair.jpg',
      ],
      variants: [
        { sku: 'SIENNA-LOUNGE-S', size: Size.S, colorHex: '#945958', price: 320, stock: 11 },
        { sku: 'SIENNA-LOUNGE-M', size: Size.M, colorHex: '#945958', price: 320, stock: 7 },
        { sku: 'SIENNA-LOUNGE-L', size: Size.L, colorHex: '#945958', price: 320, stock: 5 },
      ],
    },
    {
      name: 'Atelier Drape Dress',
      slug: 'atelier-drape-dress',
      description: 'A fluid dress with a concealed seam and sculpted drape inspired by couture movement.',
      shortDescription: 'Couture drape for golden-hour evenings.',
      price: 360,
      compareAtPrice: 440,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'new-arrivals',
      primaryImage: 'https://images.example.com/atelier-drape-dress-primary.jpg',
      images: [
        'https://images.example.com/atelier-drape-dress-primary.jpg',
        'https://images.example.com/atelier-drape-dress-detail.jpg',
        'https://images.example.com/atelier-drape-dress-back.jpg',
      ],
      variants: [
        { sku: 'ATELIER-DRAPE-S', size: Size.S, colorHex: '#945958', price: 360, stock: 6 },
        { sku: 'ATELIER-DRAPE-M', size: Size.M, colorHex: '#945958', price: 360, stock: 4 },
        { sku: 'ATELIER-DRAPE-L', size: Size.L, colorHex: '#945958', price: 360, stock: 3 },
      ],
    },
  ];

  for (const product of products) {
    const existingProduct = await prisma.product.findUnique({
      where: { slug: product.slug },
    });

    if (existingProduct) {
      continue;
    }

    const category = categoryMap.get(product.categorySlug);

    if (!category) {
      continue;
    }

    const createdProduct = await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        isFeatured: product.isFeatured,
        status: product.status,
        categoryId: category.id,
        images: {
          create: product.images.map((url, index) => ({
            url,
            altText: `${product.name} ${index + 1}`,
            isPrimary: url === product.primaryImage,
          })),
        },
        variants: {
          create: product.variants.map((variant) => ({
            sku: variant.sku,
            colorHex: variant.colorHex,
            size: variant.size,
            price: variant.price,
            stock: variant.stock,
            isAvailable: true,
          })),
        },
      },
    });

    console.log(`Seeded product: ${createdProduct.name}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
