-- Insert permissions into Permission table if they don't already exist
INSERT INTO "Permission" ("id", "key", "label", "createdAt")
VALUES
  ('perm_orders_view', 'orders.view', 'عرض الطلبات', CURRENT_TIMESTAMP),
  ('perm_orders_update_status', 'orders.update_status', 'تحديث حالة الطلب', CURRENT_TIMESTAMP),
  ('perm_orders_refund', 'orders.refund', 'استرداد الأموال', CURRENT_TIMESTAMP),
  ('perm_customers_view', 'customers.view', 'عرض العملاء', CURRENT_TIMESTAMP),
  ('perm_customers_update', 'customers.update', 'تحديث بيانات العملاء', CURRENT_TIMESTAMP),
  ('perm_products_view', 'products.view', 'عرض المنتجات', CURRENT_TIMESTAMP),
  ('perm_products_edit', 'products.edit', 'تعديل المنتجات', CURRENT_TIMESTAMP),
  ('perm_settings_manage', 'settings.manage', 'إدارة الإعدادات', CURRENT_TIMESTAMP),
  ('perm_users_manage', 'users.manage', 'إدارة المستخدمين', CURRENT_TIMESTAMP),
  ('perm_lists_manage', 'lists.manage', 'إدارة القوائم', CURRENT_TIMESTAMP),
  ('perm_automation_manage', 'automation.manage', 'إدارة الأتمتة', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Link permissions to full_admin role
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'full_admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
