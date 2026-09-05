import { PrismaClient, ProductStatus, Size, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ADMIN_INITIAL_PASSWORD presence outside local development/test is enforced
  // at module-load time in environment.validation.ts (the single source of
  // truth for this check), so no duplicate check is needed here.
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ?? 'development-only-admin-password';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: 'admin@rive.com' },
    update: {
      fullName: 'RIVÉ Admin',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
    },
    create: {
      fullName: 'RIVÉ Admin',
      email: 'admin@rive.com',
      passwordHash: hashedPassword,
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
    {
      name: 'Special Offers',
      slug: 'special-offers',
      description: 'العروض والخصومات — limited-time savings on RIVÉ luxury favorites.',
      isFeatured: true,
    },
    {
      name: 'Under EGP 200',
      slug: 'under-egp-200',
      description: 'منتجات تحت 200 ج.م — accessible luxury accessories under 200 EGP.',
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
    {
      name: 'Amara Satin Robe',
      slug: 'amara-satin-robe',
      description: 'A weightless satin robe with a hand-finished shawl collar, now offered at a special price.',
      shortDescription: 'Signature satin robe at a limited-time discount.',
      price: 210,
      compareAtPrice: 300,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'special-offers',
      primaryImage: 'https://images.example.com/amara-satin-robe-primary.jpg',
      images: [
        'https://images.example.com/amara-satin-robe-primary.jpg',
        'https://images.example.com/amara-satin-robe-detail.jpg',
        'https://images.example.com/amara-satin-robe-back.jpg',
      ],
      variants: [
        { sku: 'AMARA-ROBE-S', size: Size.S, colorHex: '#945958', price: 210, stock: 10 },
        { sku: 'AMARA-ROBE-M', size: Size.M, colorHex: '#945958', price: 210, stock: 8 },
        { sku: 'AMARA-ROBE-L', size: Size.L, colorHex: '#945958', price: 210, stock: 6 },
      ],
    },
    {
      name: 'Noor Lace Camisole',
      slug: 'noor-lace-camisole',
      description: 'A delicate lace-trimmed camisole in fluid satin, marked down for our seasonal offers edit.',
      shortDescription: 'Lace-trimmed camisole, now at a special offer price.',
      price: 160,
      compareAtPrice: 220,
      isFeatured: false,
      status: ProductStatus.ACTIVE,
      categorySlug: 'special-offers',
      primaryImage: 'https://images.example.com/noor-lace-camisole-primary.jpg',
      images: [
        'https://images.example.com/noor-lace-camisole-primary.jpg',
        'https://images.example.com/noor-lace-camisole-detail.jpg',
        'https://images.example.com/noor-lace-camisole-back.jpg',
      ],
      variants: [
        { sku: 'NOOR-CAMI-S', size: Size.S, colorHex: '#945958', price: 160, stock: 14 },
        { sku: 'NOOR-CAMI-M', size: Size.M, colorHex: '#945958', price: 160, stock: 9 },
        { sku: 'NOOR-CAMI-L', size: Size.L, colorHex: '#945958', price: 160, stock: 7 },
      ],
    },
    {
      name: 'RIVÉ Silk Scrunchie',
      slug: 'rive-silk-scrunchie',
      description: 'A pure silk scrunchie finished with the RIVÉ signature stitch, gentle on hair and effortlessly elevated.',
      shortDescription: 'Everyday silk scrunchie, RIVÉ finish.',
      price: 150,
      compareAtPrice: null,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'under-egp-200',
      primaryImage: 'https://images.example.com/rive-silk-scrunchie-primary.jpg',
      images: [
        'https://images.example.com/rive-silk-scrunchie-primary.jpg',
        'https://images.example.com/rive-silk-scrunchie-detail.jpg',
      ],
      variants: [{ sku: 'RIVE-SCRUNCHIE-OS', size: Size.S, colorHex: '#945958', price: 150, stock: 40 }],
    },
    {
      name: 'RIVÉ Satin Sleep Mask',
      slug: 'rive-satin-sleep-mask',
      description: 'A cloud-soft satin sleep mask with an adjustable strap, designed for a restful RIVÉ ritual.',
      shortDescription: 'Adjustable satin sleep mask for nightly rituals.',
      price: 180,
      compareAtPrice: null,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: 'under-egp-200',
      primaryImage: 'https://images.example.com/rive-satin-sleep-mask-primary.jpg',
      images: [
        'https://images.example.com/rive-satin-sleep-mask-primary.jpg',
        'https://images.example.com/rive-satin-sleep-mask-detail.jpg',
      ],
      variants: [{ sku: 'RIVE-SLEEPMASK-OS', size: Size.S, colorHex: '#945958', price: 180, stock: 30 }],
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
