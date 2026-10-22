/**
 * Every permission key that a controller can require via @RequirePermission.
 * Kept in sync with prisma/seed-logic.ts; a spec fails if a controller uses a key
 * that is missing here.
 */
export const DEFAULT_PERMISSIONS: ReadonlyArray<{ key: string; label: string }> = [
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
  { key: "stats.view", label: "عرض الإحصائيات" },
  { key: "coupons.manage", label: "إدارة الكوبونات" },
  { key: "content.manage", label: "إدارة المحتوى (البانرات والصفحات)" },
  { key: "expenses.manage", label: "إدارة المصروفات" },
  { key: "suppliers.manage", label: "إدارة الموردين" },
];
