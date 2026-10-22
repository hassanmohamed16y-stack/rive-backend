/**
 * Full catalog of admin permissions. Every admin route declares exactly one of these keys via
 * @RequirePermission (a spec enforces that). Roles are built by assigning any subset of them.
 *
 * Key format: "<resource>.<action>" - view / create / edit / delete plus a few special actions.
 */
export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

const g = (group: string, items: Array<[string, string]>): PermissionDef[] =>
  items.map(([key, label]) => ({ key, label, group }));

export const PERMISSION_CATALOG: ReadonlyArray<PermissionDef> = [
  ...g("الإحصائيات", [["stats.view", "عرض الإحصائيات"]]),
  ...g("الطلبات", [
    ["orders.view", "عرض الطلبات والمدفوعات"],
    ["orders.update_status", "تغيير حالة الطلب والشحن"],
    ["orders.refund", "استرداد الأموال"],
    ["orders.notes", "إضافة وتعديل وحذف ملاحظات الطلب"],
    ["orders.export", "تصدير الطلبات"],
  ]),
  ...g("العملاء", [
    ["customers.view", "عرض العملاء"],
    ["customers.edit", "تعديل العميل (حظر / إلغاء حظر / إرسال بريد)"],
    ["customers.delete", "حذف عميل"],
    ["customers.approve", "اعتماد أو رفض طلبات حذف البيانات"],
    ["customers.export", "تصدير العملاء"],
  ]),
  ...g("المحادثات والسلات", [
    ["conversations.view", "عرض المحادثات"],
    ["conversations.reply", "الرد على المحادثات"],
    ["abandoned_carts.view", "عرض السلات المتروكة"],
  ]),
  ...g("المنتجات", [
    ["products.view", "عرض المنتجات"],
    ["products.create", "إضافة منتج"],
    ["products.edit", "تعديل المنتجات (بياناتها ومتغيراتها وصورها)"],
    ["products.delete", "حذف منتج"],
    ["products.import", "استيراد المنتجات والمخزون"],
    ["products.export", "تصدير المنتجات والمخزون"],
    ["media.upload", "رفع الصور"],
  ]),
  ...g("التصنيفات", [
    ["categories.view", "عرض التصنيفات"],
    ["categories.create", "إضافة تصنيف"],
    ["categories.edit", "تعديل تصنيف"],
    ["categories.delete", "حذف تصنيف"],
  ]),
  ...g("المجموعات", [
    ["collections.view", "عرض المجموعات"],
    ["collections.create", "إضافة مجموعة"],
    ["collections.edit", "تعديل مجموعة وتحديد منتجاتها"],
    ["collections.delete", "حذف مجموعة"],
  ]),
  ...g("الحزم", [
    ["bundles.view", "عرض الحزم"],
    ["bundles.create", "إضافة حزمة"],
    ["bundles.edit", "تعديل حزمة"],
    ["bundles.delete", "حذف حزمة"],
  ]),
  ...g("التقييمات", [
    ["reviews.view", "عرض التقييمات"],
    ["reviews.edit", "الموافقة على تقييم"],
    ["reviews.delete", "حذف تقييم"],
  ]),
  ...g("الكوبونات", [
    ["coupons.view", "عرض الكوبونات"],
    ["coupons.create", "إضافة كوبون"],
    ["coupons.edit", "تعديل كوبون وتفعيله / تعطيله"],
    ["coupons.delete", "حذف كوبون"],
  ]),
  ...g("المصروفات", [
    ["expenses.view", "عرض المصروفات"],
    ["expenses.create", "إضافة مصروف"],
    ["expenses.edit", "تعديل مصروف"],
    ["expenses.delete", "حذف مصروف"],
  ]),
  ...g("الموردين", [
    ["suppliers.view", "عرض الموردين"],
    ["suppliers.create", "إضافة مورد"],
    ["suppliers.edit", "تعديل مورد"],
    ["suppliers.delete", "حذف مورد"],
  ]),
  ...g("البانرات", [
    ["banners.view", "عرض البانرات"],
    ["banners.create", "إضافة بانر"],
    ["banners.edit", "تعديل بانر"],
    ["banners.delete", "حذف بانر"],
  ]),
  ...g("الصفحات والقوالب", [
    ["pages.view", "عرض الصفحات الثابتة"],
    ["pages.edit", "تعديل الصفحات الثابتة"],
    ["templates.view", "عرض قوالب الرسائل"],
    ["templates.edit", "تعديل قوالب الرسائل"],
  ]),
  ...g("الشحن والقوائم", [
    ["zones.view", "عرض مناطق الشحن"],
    ["zones.create", "إضافة منطقة شحن"],
    ["zones.edit", "تعديل منطقة شحن وتعطيلها"],
    ["lists.view", "عرض القوائم"],
    ["lists.create", "إضافة عنصر لقائمة"],
    ["lists.edit", "تعديل عنصر قائمة وتعطيله"],
  ]),
  ...g("الأتمتة", [
    ["automation.view", "عرض الأتمتة وسجل التشغيل"],
    ["automation.edit", "تعديل الأتمتة والموافقة على العمليات"],
  ]),
  ...g("المستخدمون والتدقيق", [
    ["users.view", "عرض المستخدمين"],
    ["users.create", "إضافة مستخدم"],
    ["users.edit", "تعديل مستخدم وتعطيله"],
    ["audit.view", "عرض سجل التدقيق"],
  ]),
  ...g("الإعدادات", [
    ["settings.view", "عرض الإعدادات"],
    ["settings.edit", "تعديل الإعدادات والتجارب"],
  ]),
];

export const PERMISSION_KEYS: ReadonlyArray<string> = PERMISSION_CATALOG.map((p) => p.key);

/** Display group (Arabic) for a key; custom keys that are not in the catalog fall under "عام". */
export function groupOfPermission(key: string): string {
  return PERMISSION_CATALOG.find((p) => p.key === key)?.group ?? "عام";
}

const crud = (r: string) => [`${r}.view`, `${r}.create`, `${r}.edit`, `${r}.delete`];

/**
 * Old coarse permissions that no longer exist, and what each one now expands to, so roles
 * created before the split keep exactly the access they had. These rows are deleted after
 * their holders are migrated.
 */
export const LEGACY_PERMISSION_MAP: Readonly<Record<string, ReadonlyArray<string>>> = {
  "customers.update": ["customers.edit", "customers.delete", "conversations.reply"],
  "settings.manage": ["settings.view", "settings.edit", "templates.view", "templates.edit"],
  "users.manage": ["users.view", "users.create", "users.edit", "audit.view", "customers.approve"],
  "lists.manage": ["lists.view", "lists.create", "lists.edit", "zones.view", "zones.create", "zones.edit"],
  "automation.manage": ["automation.view", "automation.edit"],
  "coupons.manage": crud("coupons"),
  "content.manage": [...crud("banners"), "pages.view", "pages.edit", "media.upload"],
  "expenses.manage": crud("expenses"),
  "suppliers.manage": crud("suppliers"),
};

/**
 * Permissions whose name still exists in the new catalog but which used to imply more
 * (e.g. products.edit covered categories, collections, bundles and reviews). Granted once,
 * only when migrating a database that predates the split.
 */
export const LEGACY_EXTRA_GRANTS: Readonly<Record<string, ReadonlyArray<string>>> = {
  "orders.view": ["orders.export"],
  "orders.update_status": ["orders.notes"],
  "customers.view": ["customers.export", "conversations.view", "abandoned_carts.view"],
  "products.view": [
    "products.export", "categories.view", "collections.view", "bundles.view", "reviews.view",
  ],
  "products.edit": [
    "products.create", "products.delete", "products.import", "media.upload",
    "categories.create", "categories.edit", "categories.delete",
    "collections.create", "collections.edit", "collections.delete",
    "bundles.create", "bundles.edit", "bundles.delete",
    "reviews.edit", "reviews.delete",
  ],
};
