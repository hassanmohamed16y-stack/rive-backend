-- Staff sign-in name (optional, unique). Existing users are unaffected.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Page-level permissions so the owner can decide exactly what each role sees.
INSERT INTO "Permission" ("id", "key", "label", "createdAt")
VALUES
  ('perm_stats_view', 'stats.view', 'عرض الإحصائيات', CURRENT_TIMESTAMP),
  ('perm_coupons_manage', 'coupons.manage', 'إدارة الكوبونات', CURRENT_TIMESTAMP),
  ('perm_content_manage', 'content.manage', 'إدارة المحتوى (البانرات والصفحات)', CURRENT_TIMESTAMP),
  ('perm_expenses_manage', 'expenses.manage', 'إدارة المصروفات', CURRENT_TIMESTAMP),
  ('perm_suppliers_manage', 'suppliers.manage', 'إدارة الموردين', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Keep existing roles working: these endpoints used to be guarded by older keys,
-- so every role that held the old key gets the matching new one.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", np."id"
FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId"
JOIN "Permission" np ON np."key" = 'stats.view'
WHERE op."key" IN ('orders.view', 'customers.view', 'products.view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", np."id"
FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId"
JOIN "Permission" np ON np."key" IN ('coupons.manage', 'content.manage', 'expenses.manage', 'suppliers.manage')
WHERE op."key" = 'settings.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- full_admin always holds every permission.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'full_admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
