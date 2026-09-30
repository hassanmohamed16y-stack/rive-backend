-- Insert missing permissions
INSERT INTO "Permission" ("id", "key", "label", "createdAt")
VALUES
    (gen_random_uuid(), 'suppliers.manage', 'إدارة الموردين', NOW()),
    (gen_random_uuid(), 'expenses.manage', 'إدارة المصروفات التشغيلية', NOW()),
    (gen_random_uuid(), 'data_deletion.manage', 'إدارة طلبات حذف البيانات', NOW())
ON CONFLICT ("key") DO NOTHING;

-- Map new permissions to full_admin role
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'full_admin'
  AND p."key" IN ('suppliers.manage', 'expenses.manage', 'data_deletion.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
