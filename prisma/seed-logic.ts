import {
  AutomationRunStatus,
  PrismaClient,
  ProductStatus,
  Size,
  UserRole,
  WorkflowTrustLevel,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // Seed permissions
  const permissionsData = [
    { key: "orders.view", label: "عرض الطلبات" },
    { key: "orders.update_status", label: "تحديث حالة الطلب" },
    { key: "orders.refund", label: "استرداد الأموال" },
    { key: "customers.view", label: "عرض العملاء" },
    { key: "customers.update", label: "تحديث بيانات العملاء" },
    { key: "products.view", label: "عرض المنتجات" },
    { key: "products.edit", label: "تعديل المنتجات" },
    { key: "settings.manage", label: "إدارة الإعدادات" },
    { key: "users.manage", label: "إدارة المستخدمين" },
    { key: "lists.manage", label: "إدارة القوائم" },
    { key: "automation.manage", label: "إدارة الأتمتة" },
  ];

  const permissionMap = new Map<string, string>();
  for (const perm of permissionsData) {
    const createdPerm = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label },
      create: perm,
    });
    permissionMap.set(perm.key, createdPerm.id);
  }

  // Seed roles
  const rolesData = [
    {
      name: "full_admin",
      label: "مدير عام",
      permissionKeys: permissionsData.map((p) => p.key),
    },
    {
      name: "sales",
      label: "مبيعات",
      permissionKeys: [
        "orders.view",
        "orders.update_status",
        "customers.view",
        "products.view",
      ],
    },
    {
      name: "support",
      label: "دعم فني",
      permissionKeys: ["orders.view", "customers.view", "customers.update"],
    },
  ];

  const roleMap = new Map<string, string>();
  for (const roleDef of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { label: roleDef.label },
      create: {
        name: roleDef.name,
        label: roleDef.label,
      },
    });
    roleMap.set(roleDef.name, role.id);

    // Sync role permissions
    const permIds = roleDef.permissionKeys
      .map((k) => permissionMap.get(k))
      .filter((id): id is string => Boolean(id));

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  const fullAdminRoleId = roleMap.get("full_admin");

  // The admin user is only created or migrated here, never resetting passwordHash
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@rive.com" },
  });

  if (!existingAdmin) {
    const adminPassword =
      process.env.ADMIN_INITIAL_PASSWORD ?? "development-only-admin-password";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        fullName: "RIVÉ Admin",
        email: "admin@rive.com",
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        roleId: fullAdminRoleId,
        isActive: true,
      },
    });
    console.log("[Seed] Created initial admin user admin@rive.com.");
  } else if (!existingAdmin.roleId && fullAdminRoleId) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        roleId: fullAdminRoleId,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log("[Seed] Updated role/roleId for existing admin user admin@rive.com.");
  } else {
    console.log("[Seed] Admin user admin@rive.com already exists. Password hash was preserved (untouched).");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: "user@rive.com" },
  });

  if (!existingUser) {
    const userPassword =
      process.env.USER_INITIAL_PASSWORD ?? "development-only-user-password";
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    await prisma.user.create({
      data: {
        fullName: "RIVÉ Customer",
        email: "user@rive.com",
        passwordHash: hashedPassword,
        role: UserRole.CUSTOMER,
      },
    });
  }

  // Seed System Lists (ListType and ListItems)
  const listTypesData = [
    {
      key: "product_category",
      label: "أقسام المنتجات",
      items: [
        { key: "lingerie", labelAr: "ملابس داخلية", labelEn: "Lingerie", sortOrder: 1 },
        { key: "homewear", labelAr: "ملابس منزلية", labelEn: "Homewear", sortOrder: 2 },
        { key: "collections", labelAr: "تشكيلات", labelEn: "Collections", sortOrder: 3 },
        { key: "new_arrivals", labelAr: "وصل حديثاً", labelEn: "New Arrivals", sortOrder: 4 },
        { key: "special_offers", labelAr: "العروض الخاصة", labelEn: "Special Offers", sortOrder: 5 },
        { key: "under_egp_200", labelAr: "تحت 200 ج.م", labelEn: "Under EGP 200", sortOrder: 6 },
        { key: "clothing", labelAr: "ملابس", labelEn: "Clothing", sortOrder: 7 },
        { key: "shoes", labelAr: "أحذية", labelEn: "Shoes", sortOrder: 8 },
        { key: "accessories", labelAr: "إكسسوارات", labelEn: "Accessories", sortOrder: 9 },
      ],
    },
    {
      key: "product_tag",
      label: "وسوم المنتجات",
      items: [
        { key: "featured", labelAr: "المميزة", labelEn: "Featured", sortOrder: 1 },
        { key: "new_arrivals", labelAr: "وصل حديثاً", labelEn: "New Arrivals", sortOrder: 2 },
        { key: "lingerie", labelAr: "لانجري", labelEn: "Lingerie", sortOrder: 3 },
        { key: "offers", labelAr: "العروض", labelEn: "Offers", sortOrder: 4 },
      ],
    },
  ];

  for (const listTypeDef of listTypesData) {
    const listType = await prisma.listType.upsert({
      where: { key: listTypeDef.key },
      update: { label: listTypeDef.label },
      create: { key: listTypeDef.key, label: listTypeDef.label },
    });

    for (const itemDef of listTypeDef.items) {
      await prisma.listItem.upsert({
        where: {
          listTypeId_key: {
            listTypeId: listType.id,
            key: itemDef.key,
          },
        },
        update: {
          labelAr: itemDef.labelAr,
          labelEn: itemDef.labelEn,
          sortOrder: itemDef.sortOrder,
        },
        create: {
          listTypeId: listType.id,
          key: itemDef.key,
          labelAr: itemDef.labelAr,
          labelEn: itemDef.labelEn,
          sortOrder: itemDef.sortOrder,
        },
      });
    }
  }

  const categories = [
    {
      name: "Lingerie",
      slug: "lingerie",
      description: "Sheer, sculpting essentials for intimate layering.",
      isFeatured: true,
    },
    {
      name: "Homewear",
      slug: "homewear",
      description: "Silky silhouettes for slow mornings and late nights.",
      isFeatured: true,
    },
    {
      name: "Collections",
      slug: "collections",
      description: "Curated capsule pieces from our seasonal art direction.",
      isFeatured: false,
    },
    {
      name: "New Arrivals",
      slug: "new-arrivals",
      description: "Fresh luxury pieces just introduced to the atelier edit.",
      isFeatured: true,
    },
    {
      name: "Special Offers",
      slug: "special-offers",
      description:
        "العروض والخصومات — limited-time savings on RIVÉ luxury favorites.",
      isFeatured: true,
    },
    {
      name: "Under EGP 200",
      slug: "under-egp-200",
      description:
        "منتجات تحت 200 ج.م — accessible luxury accessories under 200 EGP.",
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

  const categoryMap = new Map(
    createdCategories.map((category) => [category.slug, category]),
  );

  const products = [
    {
      name: "Luna Silk Set",
      slug: "luna-silk-set",
      description:
        "A fluid satin set designed for an evening ritual with understated drama.",
      shortDescription: "Silk set in deep plum with rose velvet finish.",
      price: 280,
      compareAtPrice: 360,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "lingerie",
      primaryImage: "https://images.example.com/luna-silk-set-primary.jpg",
      images: [
        "https://images.example.com/luna-silk-set-primary.jpg",
        "https://images.example.com/luna-silk-set-detail.jpg",
        "https://images.example.com/luna-silk-set-back.jpg",
      ],
      variants: [
        {
          sku: "LUNA-SILK-S",
          size: Size.S,
          colorHex: "#945958",
          price: 280,
          stock: 10000,
        },
        {
          sku: "LUNA-SILK-M",
          size: Size.M,
          colorHex: "#945958",
          price: 280,
          stock: 10000,
        },
        {
          sku: "LUNA-SILK-L",
          size: Size.L,
          colorHex: "#945958",
          price: 280,
          stock: 10000,
        },
      ],
    },
    {
      name: "Velvet Bloom Slip",
      slug: "velvet-bloom-slip",
      description:
        "A lightweight slip with a soft sheen and body-skimming silhouette.",
      shortDescription: "Soft drape, couture finish, evening softness.",
      price: 240,
      compareAtPrice: 310,
      isFeatured: false,
      status: ProductStatus.ACTIVE,
      categorySlug: "collections",
      primaryImage: "https://images.example.com/velvet-bloom-slip-primary.jpg",
      images: [
        "https://images.example.com/velvet-bloom-slip-primary.jpg",
        "https://images.example.com/velvet-bloom-slip-front.jpg",
        "https://images.example.com/velvet-bloom-slip-back.jpg",
      ],
      variants: [
        {
          sku: "VELVET-BLOOM-S",
          size: Size.S,
          colorHex: "#945958",
          price: 240,
          stock: 10000,
        },
        {
          sku: "VELVET-BLOOM-M",
          size: Size.M,
          colorHex: "#945958",
          price: 240,
          stock: 10000,
        },
        {
          sku: "VELVET-BLOOM-L",
          size: Size.L,
          colorHex: "#945958",
          price: 240,
          stock: 10000,
        },
      ],
    },
    {
      name: "Sienna Lounge Set",
      slug: "sienna-lounge-set",
      description:
        "Relaxed tailoring in a rich terracotta tone with a brushed matte finish.",
      shortDescription:
        "Elevated comfort for slow mornings and private rituals.",
      price: 320,
      compareAtPrice: 390,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "homewear",
      primaryImage: "https://images.example.com/sienna-lounge-set-primary.jpg",
      images: [
        "https://images.example.com/sienna-lounge-set-primary.jpg",
        "https://images.example.com/sienna-lounge-set-detail.jpg",
        "https://images.example.com/sienna-lounge-set-chair.jpg",
      ],
      variants: [
        {
          sku: "SIENNA-LOUNGE-S",
          size: Size.S,
          colorHex: "#945958",
          price: 320,
          stock: 10000,
        },
        {
          sku: "SIENNA-LOUNGE-M",
          size: Size.M,
          colorHex: "#945958",
          price: 320,
          stock: 10000,
        },
        {
          sku: "SIENNA-LOUNGE-L",
          size: Size.L,
          colorHex: "#945958",
          price: 320,
          stock: 10000,
        },
      ],
    },
    {
      name: "Atelier Drape Dress",
      slug: "atelier-drape-dress",
      description:
        "A fluid dress with a concealed seam and sculpted drape inspired by couture movement.",
      shortDescription: "Couture drape for golden-hour evenings.",
      price: 360,
      compareAtPrice: 440,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "new-arrivals",
      primaryImage:
        "https://images.example.com/atelier-drape-dress-primary.jpg",
      images: [
        "https://images.example.com/atelier-drape-dress-primary.jpg",
        "https://images.example.com/atelier-drape-dress-detail.jpg",
        "https://images.example.com/atelier-drape-dress-back.jpg",
      ],
      variants: [
        {
          sku: "ATELIER-DRAPE-S",
          size: Size.S,
          colorHex: "#945958",
          price: 360,
          stock: 10000,
        },
        {
          sku: "ATELIER-DRAPE-M",
          size: Size.M,
          colorHex: "#945958",
          price: 360,
          stock: 10000,
        },
        {
          sku: "ATELIER-DRAPE-L",
          size: Size.L,
          colorHex: "#945958",
          price: 360,
          stock: 10000,
        },
      ],
    },
    {
      name: "Amara Satin Robe",
      slug: "amara-satin-robe",
      description:
        "A weightless satin robe with a hand-finished shawl collar, now offered at a special price.",
      shortDescription: "Signature satin robe at a limited-time discount.",
      price: 210,
      compareAtPrice: 300,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "special-offers",
      primaryImage: "https://images.example.com/amara-satin-robe-primary.jpg",
      images: [
        "https://images.example.com/amara-satin-robe-primary.jpg",
        "https://images.example.com/amara-satin-robe-detail.jpg",
        "https://images.example.com/amara-satin-robe-back.jpg",
      ],
      variants: [
        {
          sku: "AMARA-ROBE-S",
          size: Size.S,
          colorHex: "#945958",
          price: 210,
          stock: 10000,
        },
        {
          sku: "AMARA-ROBE-M",
          size: Size.M,
          colorHex: "#945958",
          price: 210,
          stock: 10000,
        },
        {
          sku: "AMARA-ROBE-L",
          size: Size.L,
          colorHex: "#945958",
          price: 210,
          stock: 10000,
        },
      ],
    },
    {
      name: "Noor Lace Camisole",
      slug: "noor-lace-camisole",
      description:
        "A delicate lace-trimmed camisole in fluid satin, marked down for our seasonal offers edit.",
      shortDescription: "Lace-trimmed camisole, now at a special offer price.",
      price: 160,
      compareAtPrice: 220,
      isFeatured: false,
      status: ProductStatus.ACTIVE,
      categorySlug: "special-offers",
      primaryImage: "https://images.example.com/noor-lace-camisole-primary.jpg",
      images: [
        "https://images.example.com/noor-lace-camisole-primary.jpg",
        "https://images.example.com/noor-lace-camisole-detail.jpg",
        "https://images.example.com/noor-lace-camisole-back.jpg",
      ],
      variants: [
        {
          sku: "NOOR-CAMI-S",
          size: Size.S,
          colorHex: "#945958",
          price: 160,
          stock: 10000,
        },
        {
          sku: "NOOR-CAMI-M",
          size: Size.M,
          colorHex: "#945958",
          price: 160,
          stock: 10000,
        },
        {
          sku: "NOOR-CAMI-L",
          size: Size.L,
          colorHex: "#945958",
          price: 160,
          stock: 10000,
        },
      ],
    },
    {
      name: "RIVÉ Silk Scrunchie",
      slug: "rive-silk-scrunchie",
      description:
        "A pure silk scrunchie finished with the RIVÉ signature stitch, gentle on hair and effortlessly elevated.",
      shortDescription: "Everyday silk scrunchie, RIVÉ finish.",
      price: 150,
      compareAtPrice: null,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "under-egp-200",
      primaryImage:
        "https://images.example.com/rive-silk-scrunchie-primary.jpg",
      images: [
        "https://images.example.com/rive-silk-scrunchie-primary.jpg",
        "https://images.example.com/rive-silk-scrunchie-detail.jpg",
      ],
      variants: [
        {
          sku: "RIVE-SCRUNCHIE-OS",
          size: Size.S,
          colorHex: "#945958",
          price: 150,
          stock: 10000,
        },
      ],
    },
    {
      name: "RIVÉ Satin Sleep Mask",
      slug: "rive-satin-sleep-mask",
      description:
        "A cloud-soft satin sleep mask with an adjustable strap, designed for a restful RIVÉ ritual.",
      shortDescription: "Adjustable satin sleep mask for nightly rituals.",
      price: 180,
      compareAtPrice: null,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      categorySlug: "under-egp-200",
      primaryImage:
        "https://images.example.com/rive-satin-sleep-mask-primary.jpg",
      images: [
        "https://images.example.com/rive-satin-sleep-mask-primary.jpg",
        "https://images.example.com/rive-satin-sleep-mask-detail.jpg",
      ],
      variants: [
        {
          sku: "RIVE-SLEEPMASK-OS",
          size: Size.S,
          colorHex: "#945958",
          price: 180,
          stock: 10000,
        },
      ],
    },
  ];

  for (const product of products) {
    const category = categoryMap.get(product.categorySlug);

    if (!category) {
      continue;
    }

    const sharedData = {
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      isFeatured: product.isFeatured,
      status: product.status,
      categoryId: category.id,
    };

    // Upsert the product itself first so we always have a stable id to work
    // with, regardless of whether it already existed.
    let upsertedProduct;
    try {
      upsertedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: sharedData,
        create: { ...sharedData, slug: product.slug },
      });
    } catch (error) {
      console.error(`Failed to upsert product ${product.name}:`, error);
      continue;
    }

    // Images have no relations pointing back at them, so replacing them via
    // delete + recreate is always safe. Still guard it so a single bad
    // product never aborts the whole seed run.
    try {
      await prisma.$transaction([
        prisma.productImage.deleteMany({
          where: { productId: upsertedProduct.id },
        }),
        prisma.productImage.createMany({
          data: product.images.map((url, index) => ({
            productId: upsertedProduct.id,
            url,
            altText: `${product.name} ${index + 1}`,
            isPrimary: url === product.primaryImage,
          })),
        }),
      ]);
    } catch (error) {
      console.error(`Failed to sync images for ${product.name}:`, error);
    }

    // Variants are referenced by OrderItem with onDelete: Restrict, so a
    // blanket deleteMany() can throw a foreign key violation once a variant
    // has been ordered. Upsert each variant by its unique sku instead, which
    // keeps existing variants (and their order history) intact.
    const seededVariantIds: string[] = [];
    for (const variant of product.variants) {
      try {
        const upsertedVariant = await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: {
            productId: upsertedProduct.id,
            colorHex: variant.colorHex,
            size: variant.size,
            price: variant.price,
            stock: variant.stock,
            isAvailable: true,
          },
          create: {
            productId: upsertedProduct.id,
            sku: variant.sku,
            colorHex: variant.colorHex,
            size: variant.size,
            price: variant.price,
            stock: variant.stock,
            isAvailable: true,
          },
        });
        seededVariantIds.push(upsertedVariant.id);
      } catch (error) {
        console.error(`Failed to upsert variant ${variant.sku}:`, error);
      }
    }

    // Clean up variants that are no longer part of the source data. If a
    // stale variant is still referenced by an existing order, deleting it
    // would violate the FK constraint, so fall back to marking it
    // unavailable instead of letting the process crash.
    try {
      const staleVariants = await prisma.productVariant.findMany({
        where: {
          productId: upsertedProduct.id,
          id: { notIn: seededVariantIds },
        },
      });

      for (const stale of staleVariants) {
        try {
          await prisma.productVariant.delete({ where: { id: stale.id } });
        } catch {
          await prisma.productVariant
            .update({
              where: { id: stale.id },
              data: { isAvailable: false, stock: 0 },
            })
            .catch((updateError) =>
              console.error(
                `Failed to deactivate stale variant ${stale.sku}:`,
                updateError,
              ),
            );
        }
      }
    } catch (error) {
      console.error(
        `Failed to clean up stale variants for ${product.name}:`,
        error,
      );
    }

    console.log(`Seeded product: ${upsertedProduct.name}`);
  }

  // Sync Category table records to ListItem entries under product_category so no category data is lost
  const existingCategoryRows = await prisma.category.findMany();
  const productCategoryType = await prisma.listType.findUnique({
    where: { key: "product_category" },
  });
  if (productCategoryType) {
    for (const cat of existingCategoryRows) {
      const itemKey = cat.slug.replace(/-/g, "_");
      await prisma.listItem.upsert({
        where: {
          listTypeId_key: {
            listTypeId: productCategoryType.id,
            key: itemKey,
          },
        },
        update: {},
        create: {
          listTypeId: productCategoryType.id,
          key: itemKey,
          labelAr: cat.name,
          labelEn: cat.name,
          sortOrder: 0,
        },
      });
    }
  }

  // Seed Automation Workflows
  const workflowsData = [
    {
      name: "رد تلقائي على استفسارات واتساب",
      description: "الرد التلقائي السريع على استفسارات العملاء الشائعة عبر واتساب",
      isActive: true,
      trustLevel: WorkflowTrustLevel.auto_execute,
      lastRunStatus: AutomationRunStatus.success,
      lastRunAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
      name: "تنبيه مخزون منخفض",
      description: "إرسال إشعار للمدير عند انخفاض كمية أي منتج عن الحد الأدنى",
      isActive: true,
      trustLevel: WorkflowTrustLevel.suggestion_only,
      lastRunStatus: AutomationRunStatus.success,
      lastRunAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    },
    {
      name: "متابعة السلات المتروكة",
      description: "إرسال تذكير للعميل الذي ترك منتجات في سلة التسوق دون إتمام الطلب",
      isActive: true,
      trustLevel: WorkflowTrustLevel.requires_approval,
      lastRunStatus: AutomationRunStatus.running,
      lastRunAt: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    },
    {
      name: "معالجة طلبات الاسترجاع",
      description: "فحص طلبات الاسترجاع المقدمة وإنشاء أمر استرجاع بعد التقييم",
      isActive: false,
      trustLevel: WorkflowTrustLevel.requires_approval,
      lastRunStatus: null,
      lastRunAt: null,
    },
  ];

  for (const wfData of workflowsData) {
    const existing = await prisma.workflow.findFirst({
      where: { name: wfData.name },
    });

    let workflow = existing;
    if (!existing) {
      workflow = await prisma.workflow.create({
        data: wfData,
      });
    }

    if (workflow) {
      // Seed an example PendingApproval for workflows requiring approval
      if (workflow.trustLevel === WorkflowTrustLevel.requires_approval && workflow.isActive) {
        const existingApproval = await prisma.pendingApproval.findFirst({
          where: { workflowId: workflow.id },
        });
        if (!existingApproval) {
          await prisma.pendingApproval.create({
            data: {
              workflowId: workflow.id,
              actionDescription: "استرجاع مبلغ لطلب #1010 بقيمة 300 ج.م",
              status: "pending",
            },
          });
        }
      }

      // Seed an example AutomationRun
      const existingRun = await prisma.automationRun.findFirst({
        where: { workflowId: workflow.id },
      });
      if (!existingRun) {
        await prisma.automationRun.create({
          data: {
            workflowId: workflow.id,
            status: wfData.lastRunStatus ?? AutomationRunStatus.success,
            details: `تشغيل تلقائي لسير العمل: ${workflow.name}`,
            startedAt: wfData.lastRunAt ?? new Date(),
            finishedAt: wfData.lastRunStatus === AutomationRunStatus.running ? null : new Date(),
          },
        });
      }
    }
  }

  // Seed / Migrate Shipping Zones
  // 1. Migrate distinct city values from existing orders so no historical data is lost or orphaned.
  const existingOrdersWithCity = await prisma.order.findMany({
    where: {
      shippingCity: {
        not: null,
      },
    },
    select: { shippingCity: true },
    distinct: ["shippingCity"],
  });

  for (const order of existingOrdersWithCity) {
    const city = order.shippingCity?.trim();
    if (city && city.length > 0) {
      await prisma.shippingZone.upsert({
        where: { cityLabel: city },
        update: {},
        create: {
          cityLabel: city,
          price: 0,
          estimatedDays: null,
          isActive: true,
          sortOrder: 0,
        },
      });
    }
  }

  // 2. Seed standard default shipping zones if they don't already exist.
  const defaultShippingZones = [
    { cityLabel: "القاهرة", price: 50, estimatedDays: 2, sortOrder: 1 },
    { cityLabel: "الجيزة", price: 50, estimatedDays: 2, sortOrder: 2 },
    { cityLabel: "الإسكندرية", price: 70, estimatedDays: 3, sortOrder: 3 },
    { cityLabel: "غير محدد", price: 0, estimatedDays: null, sortOrder: 99 },
  ];

  for (const zoneDef of defaultShippingZones) {
    await prisma.shippingZone.upsert({
      where: { cityLabel: zoneDef.cityLabel },
      update: {},
      create: {
        cityLabel: zoneDef.cityLabel,
        price: zoneDef.price,
        estimatedDays: zoneDef.estimatedDays,
        isActive: true,
        sortOrder: zoneDef.sortOrder,
      },
    });
  }

  // Seed Message Templates
  const messageTemplatesData = [
    {
      key: "order_confirmed",
      channel: "whatsapp" as const,
      subject: null,
      bodyAr: "شكراً لتسوقكم من RIVÉ! تم استلام طلبكم رقم #{{orderNumber}} بقيمة إجمالية {{totalAmount}} ج.م وجاري معالجته.",
      bodyEn: "Thank you for shopping at RIVÉ! Your order #{{orderNumber}} for total {{totalAmount}} EGP has been received and is being processed.",
      isActive: true,
    },
    {
      key: "order_shipped",
      channel: "whatsapp" as const,
      subject: null,
      bodyAr: "خبر سار! تم شحن طلبكم رقم #{{orderNumber}} من RIVÉ. {{trackingLink}}",
      bodyEn: "Great news! Your RIVÉ order #{{orderNumber}} has been shipped. {{trackingLink}}",
      isActive: true,
    },
    {
      key: "order_delivered",
      channel: "whatsapp" as const,
      subject: null,
      bodyAr: "تم توصيل طلبكم رقم #{{orderNumber}} من RIVÉ بنجاح. نتمنى أن تنال إعجابكم منتجاتنا الفاخرة!",
      bodyEn: "Your RIVÉ order #{{orderNumber}} has been delivered successfully. Enjoy your luxury items!",
      isActive: true,
    },
    {
      key: "order_cancelled",
      channel: "whatsapp" as const,
      subject: null,
      bodyAr: "تحديث الطلب: تم إلغاء طلبكم رقم #{{orderNumber}} من RIVÉ. إذا كان لديكم أي استفسار يسعدنا تواصلكم معنا.",
      bodyEn: "Order Update: Your RIVÉ order #{{orderNumber}} has been cancelled.",
      isActive: true,
    },
    {
      key: "low_stock_alert",
      channel: "whatsapp" as const,
      subject: null,
      bodyAr: "تنبيه مخزون منخفض: المنتج {{variantSku}} متبقي منه {{stock}} قطع فقط في المخزن.",
      bodyEn: "Low Stock Alert: Product variant {{variantSku}} has only {{stock}} units left in stock.",
      isActive: true,
    },
  ];

  for (const tpl of messageTemplatesData) {
    await prisma.messageTemplate.upsert({
      where: { key: tpl.key },
      update: {
        channel: tpl.channel,
        subject: tpl.subject,
        bodyAr: tpl.bodyAr,
        bodyEn: tpl.bodyEn,
        isActive: tpl.isActive,
      },
      create: tpl,
    });
  }

  // Seed Static Pages
  const staticPagesData = [
    {
      slug: "about-us",
      titleAr: "من نحن",
      titleEn: "About Us",
      contentAr: "يرجى تعديل هذا المحتوى",
      contentEn: "Please update this content",
      isPublished: true,
    },
    {
      slug: "return-policy",
      titleAr: "سياسة الاسترجاع",
      titleEn: "Return Policy",
      contentAr: "يرجى تعديل هذا المحتوى",
      contentEn: "Please update this content",
      isPublished: true,
    },
    {
      slug: "faq",
      titleAr: "الأسئلة الشائعة",
      titleEn: "FAQ",
      contentAr: "يرجى تعديل هذا المحتوى",
      contentEn: "Please update this content",
      isPublished: true,
    },
    {
      slug: "terms",
      titleAr: "الشروط والأحكام",
      titleEn: "Terms & Conditions",
      contentAr: "يرجى تعديل هذا المحتوى",
      contentEn: "Please update this content",
      isPublished: true,
    },
  ];

  for (const page of staticPagesData) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }
}
