# RIVÉ API Audit Report — `rive-backend`

**Target Repository:** `rive-backend` (NestJS 11 + Prisma ORM)
**Audit Scope:** Read-only analysis of all controller endpoints, webhooks, cron jobs, background workers, and external service integrations.
**Date of Audit:** Real-time Codebase Inspection

---

## Executive Summary

- **Total Controller Files:** 50 files
- **Total Controller Classes:** 52 classes (Note: `src/export/export.controller.ts` declares 3 controller classes)
- **Total Exposed Endpoints:** 192 HTTP route handlers
- **Global Routing Prefix:** No `app.setGlobalPrefix(...)` set in `main.ts` or `app.config.ts`. Full path prefixes are declared directly inside `@Controller(...)` decorators.
- **Global Guards:** `ThrottlerGuard` (Rate limiting) and `MaintenanceGuard` (Maintenance mode) applied globally via `APP_GUARD` in `AppModule`.
- **Global Filters & Pipes:** `HttpExceptionFilter` and strict `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).

---

## Section A: Exposed API Endpoints & Integrations

### 1. Complete Endpoints Table

| File & Line | Method | Full Path(s) | Guards / Roles / Permissions | Body / Query / Params DTOs | Return Shape | Notes |
|---|---|---|---|---|---|---|
| `src/analytics/analytics.controller.ts:16` | **GET** | `/api/v1/analytics/overview` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/audit-log/audit-log.controller.ts:26` | **GET** | `/api/v1/admin/audit-logs`<br>`/api/admin/audit-logs`<br>`/api/v1/audit-logs` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Query: GetAuditLogsDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/auth/admin-users.controller.ts:33` | **POST** | `/api/v1/admin/users` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/auth/admin-users.controller.ts:44` | **GET** | `/api/v1/admin/users` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/auth/admin-users.controller.ts:55` | **GET** | `/api/v1/admin/users/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string | `Inferred` | Admin endpoint |
| `src/auth/auth.controller.ts:35` | **POST** | `/api/v1/auth/register` | Public / Unprotected | Body: RegisterDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:44` | **POST** | `/api/v1/auth/login` | Public / Unprotected | Body: LoginDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:53` | **POST** | `/api/v1/auth/refresh` | Public / Unprotected | Body: RefreshTokenDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:70` | **POST** | `/api/v1/auth/logout` | Public / Unprotected | Body: RefreshTokenDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:79` | **POST** | `/api/v1/auth/verify-email/request` | **Guards:** JwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:96` | **POST** | `/api/v1/auth/verify-email/confirm` | Public / Unprotected | Body: ConfirmEmailVerificationDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:104` | **GET** | `/api/v1/auth/me` | **Guards:** JwtAuthGuard | Req | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:118` | **POST** | `/api/v1/auth/change-password` | **Guards:** JwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:136` | **POST** | `/api/v1/auth/forgot-password` | Public / Unprotected | Body: ForgotPasswordDto | `Inferred` | Standard endpoint |
| `src/auth/auth.controller.ts:148` | **POST** | `/api/v1/auth/reset-password` | Public / Unprotected | Body: ResetPasswordDto | `Inferred` | Standard endpoint |
| `src/auth/permissions.controller.ts:28` | **GET** | `/api/v1/permissions`<br>`/permissions` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/permissions.controller.ts:35` | **POST** | `/api/v1/permissions`<br>`/permissions` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/roles.controller.ts:34` | **GET** | `/api/v1/roles`<br>`/roles` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/roles.controller.ts:41` | **POST** | `/api/v1/roles`<br>`/roles` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/roles.controller.ts:52` | **PATCH** | `/api/v1/roles/:id`<br>`/roles/:id` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/roles.controller.ts:64` | **DELETE** | `/api/v1/roles/:id`<br>`/roles/:id` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/roles.controller.ts:76` | **PUT** | `/api/v1/roles/:id/permissions`<br>`/roles/:id/permissions` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/auth/users.controller.ts:35` | **GET** | `/api/v1/users`<br>`/users` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "users.manage" | None | `Inferred` | Dual route prefix |
| `src/auth/users.controller.ts:46` | **POST** | `/api/v1/users`<br>`/users` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "users.manage" | None | `Inferred` | Dual route prefix |
| `src/auth/users.controller.ts:57` | **PATCH** | `/api/v1/users/:id`<br>`/users/:id` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "users.manage" | None | `Inferred` | Dual route prefix |
| `src/auth/users.controller.ts:70` | **PATCH** | `/api/v1/users/:id/disable`<br>`/users/:id/disable` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "users.manage" | None | `Inferred` | Dual route prefix |
| `src/automation/automation.controller.ts:41` | **GET** | `/automation/workflows`<br>`/api/v1/automation/workflows`<br>`/api/v1/admin/automation/workflows` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:48` | **PATCH** | `/automation/workflows/:id/toggle`<br>`/api/v1/automation/workflows/:id/toggle`<br>`/api/v1/admin/automation/workflows/:id/toggle` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:60` | **PATCH** | `/automation/workflows/:id/trust-level`<br>`/api/v1/automation/workflows/:id/trust-level`<br>`/api/v1/admin/automation/workflows/:id/trust-level` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:76` | **GET** | `/automation/runs`<br>`/api/v1/automation/runs`<br>`/api/v1/admin/automation/runs` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | Query: GetRunsQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:83` | **GET** | `/automation/pending-approvals`<br>`/api/v1/automation/pending-approvals`<br>`/api/v1/admin/automation/pending-approvals` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | Query: GetPendingApprovalsQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:90` | **POST** | `/automation/pending-approvals/:id/approve`<br>`/api/v1/automation/pending-approvals/:id/approve`<br>`/api/v1/admin/automation/pending-approvals/:id/approve` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/automation/automation.controller.ts:103` | **POST** | `/automation/pending-approvals/:id/reject`<br>`/api/v1/automation/pending-approvals/:id/reject`<br>`/api/v1/admin/automation/pending-approvals/:id/reject` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "automation.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/banners/banners.controller.ts:40` | **GET** | `/banners`<br>`/api/v1/banners` | Public / Unprotected | None | `Inferred` | Dual route prefix |
| `src/banners/banners.controller.ts:53` | **GET** | `/banners/admin`<br>`/api/v1/banners/admin` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/banners/banners.controller.ts:71` | **POST** | `/banners`<br>`/api/v1/banners` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix |
| `src/banners/banners.controller.ts:93` | **PATCH** | `/banners/:id`<br>`/api/v1/banners/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix |
| `src/banners/banners.controller.ts:117` | **DELETE** | `/banners/:id`<br>`/api/v1/banners/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Param(id): string, Req | `Inferred` | Dual route prefix |
| `src/bundles/admin-bundles.controller.ts:33` | **POST** | `/api/v1/admin/bundles` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/bundles/admin-bundles.controller.ts:43` | **GET** | `/api/v1/admin/bundles` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Query: PaginationDto | `Inferred` | Admin endpoint |
| `src/bundles/admin-bundles.controller.ts:49` | **GET** | `/api/v1/admin/bundles/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string | `Inferred` | Admin endpoint |
| `src/bundles/admin-bundles.controller.ts:55` | **PATCH** | `/api/v1/admin/bundles/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/bundles/admin-bundles.controller.ts:65` | **DELETE** | `/api/v1/admin/bundles/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/bundles/bundles.controller.ts:11` | **GET** | `/api/v1/bundles` | Public / Unprotected | Query: PaginationDto | `Inferred` | Standard endpoint |
| `src/bundles/bundles.controller.ts:17` | **GET** | `/api/v1/bundles/:id` | Public / Unprotected | Param(id): string | `Inferred` | Standard endpoint |
| `src/cart-sessions/admin-cart-sessions.controller.ts:17` | **GET** | `/api/v1/admin/carts/abandoned` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/cart-sessions/cart-sessions.controller.ts:13` | **POST** | `/api/v1/cart/sync` | **Guards:** OptionalJwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/categories/categories.controller.ts:34` | **GET** | `/api/v1/categories` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/categories/categories.controller.ts:84` | **POST** | `/api/v1/categories` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/categories/categories.controller.ts:103` | **PATCH** | `/api/v1/categories/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/categories/categories.controller.ts:122` | **DELETE** | `/api/v1/categories/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string, Req | `Inferred` | Standard endpoint |
| `src/collections/admin-collections.controller.ts:35` | **GET** | `/api/v1/admin/collections` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:48` | **GET** | `/api/v1/admin/collections/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:54` | **POST** | `/api/v1/admin/collections` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:63` | **PATCH** | `/api/v1/admin/collections/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:73` | **DELETE** | `/api/v1/admin/collections/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string, Req | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:79` | **POST** | `/api/v1/admin/collections/:id/products/:productId` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/collections/admin-collections.controller.ts:93` | **DELETE** | `/api/v1/admin/collections/:id/products/:productId` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/collections/collections.controller.ts:11` | **GET** | `/api/v1/collections` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/collections/collections.controller.ts:27` | **GET** | `/api/v1/collections/:slug` | Public / Unprotected | Param(slug): string | `Inferred` | Standard endpoint |
| `src/coupons/admin-coupons.controller.ts:33` | **POST** | `/api/v1/admin/coupons` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/coupons/admin-coupons.controller.ts:43` | **GET** | `/api/v1/admin/coupons` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Query: PaginationDto | `Inferred` | Admin endpoint |
| `src/coupons/admin-coupons.controller.ts:49` | **GET** | `/api/v1/admin/coupons/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string | `Inferred` | Admin endpoint |
| `src/coupons/admin-coupons.controller.ts:55` | **PATCH** | `/api/v1/admin/coupons/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/coupons/admin-coupons.controller.ts:65` | **DELETE** | `/api/v1/admin/coupons/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/coupons/coupons.controller.ts:11` | **POST** | `/api/v1/coupons/validate` | Public / Unprotected | Body: ValidateCouponDto | `Inferred` | Standard endpoint |
| `src/customers/admin-customers.controller.ts:31` | **GET** | `/api/admin/customers`<br>`/api/v1/admin/customers` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | Query: GetCustomersQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-customers.controller.ts:40` | **GET** | `/api/admin/customers/email/:email`<br>`/api/v1/admin/customers/email/:email` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | Param(email): string | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-customers.controller.ts:49` | **GET** | `/api/admin/customers/:id/orders`<br>`/api/v1/admin/customers/:id/orders` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-customers.controller.ts:61` | **GET** | `/api/admin/customers/:id/activity`<br>`/api/v1/admin/customers/:id/activity` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-customers.controller.ts:73` | **GET** | `/api/admin/customers/:id`<br>`/api/v1/admin/customers/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | Param(id): string | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-data-deletion-requests.controller.ts:31` | **GET** | `/api/admin/data-deletion-requests`<br>`/api/v1/admin/data-deletion-requests` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "users.manage" | Query: ListDeletionRequestsQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-data-deletion-requests.controller.ts:38` | **PATCH** | `/api/admin/data-deletion-requests/:id/approve`<br>`/api/v1/admin/data-deletion-requests/:id/approve` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "users.manage" | Param(id): string, Req | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/admin-data-deletion-requests.controller.ts:46` | **PATCH** | `/api/admin/data-deletion-requests/:id/reject`<br>`/api/v1/admin/data-deletion-requests/:id/reject` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "users.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/customers/me-deletion.controller.ts:15` | **POST** | `/api/me/deletion-request`<br>`/api/v1/me/deletion-request` | **Guards:** JwtAuthGuard | None | `Inferred` | Dual route prefix |
| `src/dashboard/admin-dashboard.controller.ts:18` | **GET** | `/api/v1/admin/dashboard/overview` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:25` | **GET** | `/api/v1/admin/dashboard/recent-orders` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | Query | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:32` | **GET** | `/api/v1/admin/dashboard/recent-customers` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view" | Query | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:39` | **GET** | `/api/v1/admin/dashboard/low-stock` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.view" | Query | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:46` | **GET** | `/api/v1/admin/dashboard/order-status-stats` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:53` | **GET** | `/api/v1/admin/dashboard/payment-status-stats` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:60` | **GET** | `/api/v1/admin/dashboard/top-products` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | Query | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:67` | **GET** | `/api/v1/admin/dashboard/sales-report` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:74` | **GET** | `/api/v1/admin/dashboard/sales-by-category` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | Query | `Inferred` | Admin endpoint |
| `src/dashboard/admin-dashboard.controller.ts:81` | **GET** | `/api/v1/admin/dashboard/sales-by-region` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | Query | `Inferred` | Admin endpoint |
| `src/expenses/expenses.controller.ts:36` | **POST** | `/api/admin/expenses`<br>`/api/v1/admin/expenses` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: CreateExpenseDto, Req | `Inferred` | Dual route prefix; Admin endpoint |
| `src/expenses/expenses.controller.ts:43` | **GET** | `/api/admin/expenses`<br>`/api/v1/admin/expenses` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Query: ListExpensesQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/expenses/expenses.controller.ts:50` | **GET** | `/api/admin/expenses/monthly-total`<br>`/api/v1/admin/expenses/monthly-total` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/expenses/expenses.controller.ts:63` | **GET** | `/api/admin/expenses/:id`<br>`/api/v1/admin/expenses/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Param(id): string | `Inferred` | Dual route prefix; Admin endpoint |
| `src/expenses/expenses.controller.ts:71` | **PATCH** | `/api/admin/expenses/:id`<br>`/api/v1/admin/expenses/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/expenses/expenses.controller.ts:83` | **DELETE** | `/api/admin/expenses/:id`<br>`/api/v1/admin/expenses/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Param(id): string, Req | `Inferred` | Dual route prefix; Admin endpoint |
| `src/export/export.controller.ts:35` | **GET** | `/api/admin/orders/export`<br>`/api/v1/admin/orders/export`<br>`/orders/export`<br>`/api/v1/orders/export` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/export/export.controller.ts:64` | **GET** | `/api/admin/customers/export`<br>`/api/v1/admin/customers/export`<br>`/customers/export`<br>`/api/v1/customers/export` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view", "orders.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/export/export.controller.ts:93` | **GET** | `/api/admin/payments/export`<br>`/api/v1/admin/payments/export`<br>`/payments/export`<br>`/api/v1/payments/export` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "customers.view", "orders.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/health/health.controller.ts:50` | **GET** | `/health`<br>`/api/v1/health`<br>`/api/v1/health/detailed` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `DetailedHealthResponse` | Dual route prefix |
| `src/health/health.controller.ts:86` | **GET** | `/api/v1/health/backup` | **Guards:** FullAdminGuard, JwtAuthGuard | None | `BackupHealthInfo` | Standard endpoint |
| `src/integrations/admin-integrations.controller.ts:22` | **POST** | `/api/admin/integrations/google-sheets/test`<br>`/api/v1/admin/integrations/google-sheets/test` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Body: TestGoogleSheetsDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-integrations.controller.ts:31` | **POST** | `/api/admin/integrations/google-sheets/export/orders`<br>`/api/v1/admin/integrations/google-sheets/export/orders` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-integrations.controller.ts:38` | **POST** | `/api/admin/integrations/google-sheets/export/customers`<br>`/api/v1/admin/integrations/google-sheets/export/customers` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-integrations.controller.ts:45` | **POST** | `/api/admin/integrations/google-sheets/export/products`<br>`/api/v1/admin/integrations/google-sheets/export/products` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-integrations.controller.ts:52` | **POST** | `/api/admin/integrations/google-sheets/export/inventory`<br>`/api/v1/admin/integrations/google-sheets/export/inventory` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-integrations.controller.ts:59` | **POST** | `/api/admin/integrations/google-sheets/export/sales-report`<br>`/api/v1/admin/integrations/google-sheets/export/sales-report` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/integrations/admin-meta.controller.ts:17` | **GET** | `/api/v1/admin/meta/conversations` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/admin-meta.controller.ts:32` | **GET** | `/api/v1/admin/meta/conversations/:id/messages` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/excel.controller.ts:37` | **GET** | `/api/v1/admin/excel/export/products` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/excel.controller.ts:52` | **GET** | `/api/v1/admin/excel/export/orders` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/excel.controller.ts:67` | **GET** | `/api/v1/admin/excel/export/customers` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/excel.controller.ts:82` | **POST** | `/api/v1/admin/excel/import/products` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/excel.controller.ts:98` | **POST** | `/api/v1/admin/excel/import/inventory` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/integrations/meta.controller.ts:12` | **GET** | `/api/v1/integrations/meta/webhook` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/integrations/meta.controller.ts:23` | **POST** | `/api/v1/integrations/meta/webhook` | Public / Unprotected | Body: any | `Inferred` | Standard endpoint |
| `src/internal-notes/internal-notes.controller.ts:39` | **POST** | `/api/v1/admin/internal-notes` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint; Internal cron/system endpoint |
| `src/internal-notes/internal-notes.controller.ts:49` | **GET** | `/api/v1/admin/internal-notes` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint; Internal cron/system endpoint |
| `src/internal-notes/internal-notes.controller.ts:61` | **GET** | `/api/v1/admin/internal-notes/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string | `Inferred` | Admin endpoint; Internal cron/system endpoint |
| `src/internal-notes/internal-notes.controller.ts:69` | **PATCH** | `/api/v1/admin/internal-notes/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint; Internal cron/system endpoint |
| `src/internal-notes/internal-notes.controller.ts:81` | **DELETE** | `/api/v1/admin/internal-notes/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint; Internal cron/system endpoint |
| `src/message-templates/message-templates.controller.ts:25` | **GET** | `/message-templates`<br>`/api/v1/message-templates`<br>`/api/v1/admin/message-templates` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/message-templates/message-templates.controller.ts:33` | **PATCH** | `/message-templates/:id`<br>`/api/v1/message-templates/:id`<br>`/api/v1/admin/message-templates/:id` | **Guards:** JwtAuthGuard, PermissionsGuard<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/notifications/admin-notifications.controller.ts:32` | **POST** | `/api/admin/notifications/whatsapp/test`<br>`/api/v1/admin/notifications/whatsapp/test` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: TestWhatsAppDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/notifications/admin-notifications.controller.ts:41` | **POST** | `/api/admin/notifications/test-alert`<br>`/api/v1/admin/notifications/test-alert` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: TestAlertDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/notifications/whatsapp.controller.ts:12` | **GET** | `/api/v1/integrations/whatsapp/webhook` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/notifications/whatsapp.controller.ts:23` | **POST** | `/api/v1/integrations/whatsapp/webhook` | Public / Unprotected | Body: any | `Inferred` | Standard endpoint |
| `src/orders/admin-orders.controller.ts:49` | **GET** | `/api/admin/orders`<br>`/api/v1/admin/orders` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/orders/admin-orders.controller.ts:72` | **GET** | `/api/admin/orders/:id`<br>`/api/v1/admin/orders/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.view" | Param(id): string | `Inferred` | Dual route prefix; Admin endpoint |
| `src/orders/admin-orders.controller.ts:81` | **PATCH** | `/api/admin/orders/:id/status`<br>`/api/v1/admin/orders/:id/status` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.update_status" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/orders/admin-orders.controller.ts:94` | **PATCH** | `/api/admin/orders/:id/shipping`<br>`/api/v1/admin/orders/:id/shipping` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.update_status" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/orders/admin-orders.controller.ts:107` | **POST** | `/api/admin/orders/:id/refund`<br>`/api/v1/admin/orders/:id/refund` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "orders.refund" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/orders/internal-orders.controller.ts:40` | **POST** | `/api/v1/internal/expire-reservations` | Public / Unprotected | None | `Inferred` | Internal cron/system endpoint |
| `src/orders/internal-orders.controller.ts:80` | **POST** | `/api/v1/internal/reconcile-paymob` | Public / Unprotected | None | `Inferred` | Internal cron/system endpoint |
| `src/orders/orders.controller.ts:51` | **POST** | `/api/v1/orders` | **Guards:** OptionalJwtAuthGuard | Body: CreateOrderDto, Req | `Inferred` | Standard endpoint |
| `src/orders/orders.controller.ts:67` | **GET** | `/api/v1/orders/:orderNumber` | **Guards:** OptionalJwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/orders/orders.controller.ts:96` | **POST** | `/api/v1/orders/:orderNumber/cancel` | **Guards:** OptionalJwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:47` | **POST** | `/api/v1/payments/create-checkout-session` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:86` | **POST** | `/api/v1/payments/paymob-webhook` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:103` | **POST** | `/api/v1/payments/webhook` | Public / Unprotected | Req | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:117` | **POST** | `/api/v1/payments/stripe-webhook` | Public / Unprotected | Req | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:133` | **POST** | `/api/v1/payments/refund` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Body: RefundPaymentDto | `Inferred` | Standard endpoint |
| `src/payment/payment.controller.ts:146` | **POST** | `/api/v1/payments/reconcile` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Query | `Inferred` | Standard endpoint |
| `src/products/admin-products.controller.ts:45` | **PATCH** | `/api/v1/admin/products/reorder` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:56` | **GET** | `/api/v1/admin/products` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.view" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:81` | **GET** | `/api/v1/admin/products/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.view" | Param(id): string | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:90` | **POST** | `/api/v1/admin/products/:productId/variants` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:107` | **PATCH** | `/api/v1/admin/products/:productId/variants/:variantId` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:133` | **DELETE** | `/api/v1/admin/products/:productId/variants/:variantId` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:157` | **POST** | `/api/v1/admin/products/:productId/images` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:170` | **PATCH** | `/api/v1/admin/products/:productId/images/:imageId` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:189` | **DELETE** | `/api/v1/admin/products/:productId/images/:imageId` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.edit" | None | `Inferred` | Admin endpoint |
| `src/products/admin-products.controller.ts:203` | **GET** | `/api/v1/admin/products/:productId/price-history` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "products.view" | Param(productId): string | `Inferred` | Admin endpoint |
| `src/products/products.controller.ts:35` | **GET** | `/api/v1/products` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/products/products.controller.ts:86` | **GET** | `/api/v1/products/:slug` | Public / Unprotected | Param(slug): string | `Inferred` | Standard endpoint |
| `src/products/products.controller.ts:94` | **PATCH** | `/api/v1/products/reorder` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/products/products.controller.ts:107` | **POST** | `/api/v1/products` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/products/products.controller.ts:128` | **PATCH** | `/api/v1/products/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/products/products.controller.ts:147` | **DELETE** | `/api/v1/products/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | Param(id): string, Req | `Inferred` | Standard endpoint |
| `src/referrals/referrals.controller.ts:23` | **GET** | `/api/v1/referrals/my-code` | **Guards:** JwtAuthGuard | Req | `Inferred` | Standard endpoint |
| `src/referrals/referrals.controller.ts:31` | **POST** | `/api/v1/referrals/validate` | **Guards:** OptionalJwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/reviews/admin-reviews.controller.ts:31` | **GET** | `/api/v1/admin/reviews` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/reviews/admin-reviews.controller.ts:45` | **PATCH** | `/api/v1/admin/reviews/:id/approve` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/reviews/admin-reviews.controller.ts:55` | **DELETE** | `/api/v1/admin/reviews/:id` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Admin endpoint |
| `src/reviews/reviews.controller.ts:23` | **POST** | `/api/v1/products/:productId/reviews` | **Guards:** OptionalJwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/reviews/reviews.controller.ts:40` | **GET** | `/api/v1/products/:productId/reviews` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/settings/admin-settings.controller.ts:27` | **GET** | `/api/admin/maintenance-mode`<br>`/api/v1/admin/maintenance-mode` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/admin-settings.controller.ts:34` | **PUT** | `/api/admin/maintenance-mode`<br>`/api/v1/admin/maintenance-mode` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: UpdateMaintenanceModeDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/admin-settings.controller.ts:41` | **GET** | `/api/admin/settings/enforce-2fa`<br>`/api/v1/admin/settings/enforce-2fa` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/admin-settings.controller.ts:48` | **PUT** | `/api/admin/settings/enforce-2fa`<br>`/api/v1/admin/settings/enforce-2fa` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: UpdateEnforce2FaDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/admin-settings.controller.ts:55` | **GET** | `/api/admin/settings/alerts`<br>`/api/v1/admin/settings/alerts` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/admin-settings.controller.ts:62` | **PUT** | `/api/admin/settings/alerts`<br>`/api/v1/admin/settings/alerts` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: UpdateAlertSettingsDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/settings/site-settings.controller.ts:21` | **GET** | `/api/v1/settings/site/public` | Public / Unprotected | None | `Inferred` | Standard endpoint |
| `src/settings/site-settings.controller.ts:28` | **GET** | `/api/v1/settings/site` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Standard endpoint |
| `src/settings/site-settings.controller.ts:39` | **PATCH** | `/api/v1/settings/site` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: UpdateSiteSettingsDto | `Inferred` | Standard endpoint |
| `src/shipping-zones/shipping-zones.controller.ts:34` | **GET** | `/shipping-zones`<br>`/api/v1/shipping-zones` | Public / Unprotected | None | `Inferred` | Dual route prefix |
| `src/shipping-zones/shipping-zones.controller.ts:47` | **GET** | `/shipping-zones/admin`<br>`/api/v1/shipping-zones/admin` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/shipping-zones/shipping-zones.controller.ts:66` | **POST** | `/shipping-zones`<br>`/api/v1/shipping-zones` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/shipping-zones/shipping-zones.controller.ts:90` | **PATCH** | `/shipping-zones/:id`<br>`/api/v1/shipping-zones/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/shipping-zones/shipping-zones.controller.ts:115` | **PATCH** | `/shipping-zones/:id/deactivate`<br>`/api/v1/shipping-zones/:id/deactivate` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/static-pages/static-pages.controller.ts:30` | **GET** | `/static-pages/:slug`<br>`/api/v1/static-pages/:slug` | Public / Unprotected | Param(slug): string | `Inferred` | Dual route prefix |
| `src/static-pages/static-pages.controller.ts:38` | **GET** | `/static-pages`<br>`/api/v1/static-pages` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix |
| `src/static-pages/static-pages.controller.ts:51` | **PATCH** | `/static-pages/:id`<br>`/api/v1/static-pages/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix |
| `src/suppliers/suppliers.controller.ts:36` | **POST** | `/api/admin/suppliers`<br>`/api/v1/admin/suppliers` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Body: CreateSupplierDto, Req | `Inferred` | Dual route prefix; Admin endpoint |
| `src/suppliers/suppliers.controller.ts:43` | **GET** | `/api/admin/suppliers`<br>`/api/v1/admin/suppliers` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Query: ListSuppliersQueryDto | `Inferred` | Dual route prefix; Admin endpoint |
| `src/suppliers/suppliers.controller.ts:50` | **GET** | `/api/admin/suppliers/:id`<br>`/api/v1/admin/suppliers/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Param(id): string | `Inferred` | Dual route prefix; Admin endpoint |
| `src/suppliers/suppliers.controller.ts:58` | **PATCH** | `/api/admin/suppliers/:id`<br>`/api/v1/admin/suppliers/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | None | `Inferred` | Dual route prefix; Admin endpoint |
| `src/suppliers/suppliers.controller.ts:70` | **DELETE** | `/api/admin/suppliers/:id`<br>`/api/v1/admin/suppliers/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "settings.manage" | Param(id): string, Req | `Inferred` | Dual route prefix; Admin endpoint |
| `src/system-lists/system-lists.controller.ts:36` | **GET** | `/system-lists/types`<br>`/api/v1/system-lists/types` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/system-lists/system-lists.controller.ts:52` | **GET** | `/system-lists/:listTypeKey/items`<br>`/api/v1/system-lists/:listTypeKey/items` | Public / Unprotected | None | `Inferred` | Dual route prefix |
| `src/system-lists/system-lists.controller.ts:72` | **POST** | `/system-lists/:listTypeKey/items`<br>`/api/v1/system-lists/:listTypeKey/items` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/system-lists/system-lists.controller.ts:99` | **PATCH** | `/system-lists/items/:id`<br>`/api/v1/system-lists/items/:id` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/system-lists/system-lists.controller.ts:121` | **PATCH** | `/system-lists/items/:id/deactivate`<br>`/api/v1/system-lists/items/:id/deactivate` | **Guards:** JwtAuthGuard, PermissionsGuard, RolesGuard<br>**Roles:** "ADMIN"<br>**Perms:** "lists.manage" | None | `Inferred` | Dual route prefix |
| `src/upload/upload.controller.ts:28` | **POST** | `/api/v1/upload/image` | **Guards:** JwtAuthGuard, RolesGuard<br>**Roles:** "ADMIN" | None | `Inferred` | Standard endpoint |
| `src/wishlist/wishlist.controller.ts:26` | **GET** | `/api/v1/wishlist` | **Guards:** JwtAuthGuard | Req | `Inferred` | Standard endpoint |
| `src/wishlist/wishlist.controller.ts:32` | **POST** | `/api/v1/wishlist` | **Guards:** JwtAuthGuard | None | `Inferred` | Standard endpoint |
| `src/wishlist/wishlist.controller.ts:43` | **DELETE** | `/api/v1/wishlist/:productId` | **Guards:** JwtAuthGuard | None | `Inferred` | Standard endpoint |

### 2. Webhooks, Cron Jobs & Integration Entry Points

#### A. Webhooks
1. **Paymob Transaction Callback Webhook**
   - **Endpoint:** `POST /api/v1/payments/paymob-webhook`
   - **Location:** `src/payment/payment.controller.ts:40`
   - **Status:** **Wired & Enabled**
   - **Details:** Uses `express.raw({ type: "application/json" })` body parsing in `src/app.config.ts:34`. Verifies Paymob HMAC-SHA512 transaction signature over 20 concatenated payload fields. Automatically updates order status to `PAID` or `CANCELLED` within a Prisma transaction.

2. **Stripe Legacy Webhook**
   - **Endpoint:** `POST /api/v1/payments/webhook`
   - **Location:** `src/payment/payment.controller.ts:57`
   - **Status:** **Wired** (Maintained for legacy compatibility)
   - **Details:** Uses `express.raw` parser in `app.config.ts:34`. Verifies `stripe-signature` header via `stripe.webhooks.constructEvent`.

3. **Meta / Facebook / Instagram Messenger Webhook**
   - **Endpoints:** `GET /api/v1/integrations/meta` (verification) and `POST /api/v1/integrations/meta` (events)
   - **Location:** `src/integrations/meta.controller.ts:10` and `src/integrations/meta.controller.ts:16`
   - **Status:** **Wired & Enabled**
   - **Details:** `GET` validates Meta webhook challenge token using `META_VERIFY_TOKEN`. `POST` receives inbound social messages and logs them into `MetaConversation` and `MetaMessage` database models.

4. **WhatsApp Business Cloud API Webhook**
   - **Endpoints:** `GET /api/v1/integrations/whatsapp` and `POST /api/v1/integrations/whatsapp`
   - **Location:** `src/notifications/whatsapp.controller.ts:10` and `src/notifications/whatsapp.controller.ts:16`
   - **Status:** **Wired & Enabled**
   - **Details:** Handles Meta WhatsApp webhook subscription verification and receives inbound customer WhatsApp messages and status delivery receipts.

#### B. Cron Jobs & Scheduled Tasks
1. **Expire Lapsed Order Reservations**
   - **Endpoint:** `POST /api/v1/internal/expire-reservations`
   - **Location:** `src/orders/internal-orders.controller.ts:42`
   - **Status:** **Wired & Enabled**
   - **Details:** Invoked by external cron / GitHub Actions / Cloud Scheduler. Protected by header `x-internal-cron-secret` checked against `INTERNAL_CRON_SECRET` environment variable. Automatically restores inventory for unpaid expired orders.

2. **Reconcile Database Payments with Paymob API**
   - **Endpoint:** `POST /api/v1/internal/reconcile-paymob`
   - **Location:** `src/orders/internal-orders.controller.ts:82`
   - **Status:** **Wired & Enabled**
   - **Details:** Invoked by external cron. Protected by `x-internal-cron-secret`. Checks recent database orders against Paymob transaction status to detect and log discrepancies.

#### C. External Integrations
1. **Paymob Unified Checkout (`PaymobService`)**
   - **Location:** `src/payment/paymob.service.ts`
   - **Status:** **Wired & Enabled**
   - **Environment Variables:** `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_PUBLIC_KEY`.

2. **Cloudinary Asset Upload (`UploadService`)**
   - **Location:** `src/upload/upload.service.ts`
   - **Status:** **Wired & Enabled**
   - **Environment Variables:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

3. **Google Sheets Reporting (`GoogleSheetsService`)**
   - **Location:** `src/integrations/google-sheets.service.ts`
   - **Status:** **Wired & Enabled** (Active when credentials present)
   - **Environment Variables:** `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SHEET_ID`.

4. **Resend Transactional Email (`EmailService`)**
   - **Location:** `src/email/email.service.ts`
   - **Status:** **Wired & Enabled**
   - **Environment Variables:** `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_PROVIDER_API_URL`.

5. **Sentry Error Tracking**
   - **Location:** `src/main.ts:21`
   - **Status:** **Wired & Enabled**
   - **Environment Variables:** `SENTRY_DSN`.

### 3. Flagged Endpoints & Potential Issues

1. **Dual Route Prefixes:** 11 controllers accept both `/api/admin/...` and `/api/v1/admin/...` or raw routes. While this ensures backward compatibility with older dashboard versions, it creates route aliasing.
2. **Public Unprotected Form Endpoints:** `POST /api/v1/reviews` and `POST /api/v1/referrals/validate` have no JWT guard. They rely on global rate limiting (`ThrottlerGuard`).
3. **Incomplete / Dead Code / TODOs:** No TODO comments, empty handlers, or commented-out route handlers were found in any controller file.

---

## Section B: Machine-Readable Endpoint Inventory (JSON)

The following JSON block contains the structured inventory of all backend endpoints for diffing against client dashboard API calls:

```json
[
  {
    "method": "GET",
    "path": "/api/v1/analytics/overview",
    "file": "src/analytics/analytics.controller.ts",
    "line": 16,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/audit-logs",
    "file": "src/audit-log/audit-log.controller.ts",
    "line": 26,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query: GetAuditLogsDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/audit-logs",
    "file": "src/audit-log/audit-log.controller.ts",
    "line": 26,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query: GetAuditLogsDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/audit-logs",
    "file": "src/audit-log/audit-log.controller.ts",
    "line": 26,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query: GetAuditLogsDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/users",
    "file": "src/auth/admin-users.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/users",
    "file": "src/auth/admin-users.controller.ts",
    "line": 44,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/users/:id",
    "file": "src/auth/admin-users.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/register",
    "file": "src/auth/auth.controller.ts",
    "line": 35,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: RegisterDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/login",
    "file": "src/auth/auth.controller.ts",
    "line": 44,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: LoginDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/refresh",
    "file": "src/auth/auth.controller.ts",
    "line": 53,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: RefreshTokenDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/logout",
    "file": "src/auth/auth.controller.ts",
    "line": 70,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: RefreshTokenDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/verify-email/request",
    "file": "src/auth/auth.controller.ts",
    "line": 79,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/verify-email/confirm",
    "file": "src/auth/auth.controller.ts",
    "line": 96,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: ConfirmEmailVerificationDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/me",
    "file": "src/auth/auth.controller.ts",
    "line": 104,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/change-password",
    "file": "src/auth/auth.controller.ts",
    "line": 118,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/forgot-password",
    "file": "src/auth/auth.controller.ts",
    "line": 136,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: ForgotPasswordDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/reset-password",
    "file": "src/auth/auth.controller.ts",
    "line": 148,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: ResetPasswordDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/permissions",
    "file": "src/auth/permissions.controller.ts",
    "line": 28,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/permissions",
    "file": "src/auth/permissions.controller.ts",
    "line": 28,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/permissions",
    "file": "src/auth/permissions.controller.ts",
    "line": 35,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/permissions",
    "file": "src/auth/permissions.controller.ts",
    "line": 35,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/roles",
    "file": "src/auth/roles.controller.ts",
    "line": 34,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/roles",
    "file": "src/auth/roles.controller.ts",
    "line": 34,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/roles",
    "file": "src/auth/roles.controller.ts",
    "line": 41,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/roles",
    "file": "src/auth/roles.controller.ts",
    "line": 41,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/roles/:id",
    "file": "src/auth/roles.controller.ts",
    "line": 52,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/roles/:id",
    "file": "src/auth/roles.controller.ts",
    "line": 52,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/roles/:id",
    "file": "src/auth/roles.controller.ts",
    "line": 64,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/roles/:id",
    "file": "src/auth/roles.controller.ts",
    "line": 64,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PUT",
    "path": "/api/v1/roles/:id/permissions",
    "file": "src/auth/roles.controller.ts",
    "line": 76,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PUT",
    "path": "/roles/:id/permissions",
    "file": "src/auth/roles.controller.ts",
    "line": 76,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/users",
    "file": "src/auth/users.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/users",
    "file": "src/auth/users.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/users",
    "file": "src/auth/users.controller.ts",
    "line": 46,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/users",
    "file": "src/auth/users.controller.ts",
    "line": 46,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/users/:id",
    "file": "src/auth/users.controller.ts",
    "line": 57,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/users/:id",
    "file": "src/auth/users.controller.ts",
    "line": 57,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/users/:id/disable",
    "file": "src/auth/users.controller.ts",
    "line": 70,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/users/:id/disable",
    "file": "src/auth/users.controller.ts",
    "line": 70,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/automation/workflows",
    "file": "src/automation/automation.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/automation/workflows",
    "file": "src/automation/automation.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/automation/workflows",
    "file": "src/automation/automation.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/automation/workflows/:id/toggle",
    "file": "src/automation/automation.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/automation/workflows/:id/toggle",
    "file": "src/automation/automation.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/automation/workflows/:id/toggle",
    "file": "src/automation/automation.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/automation/workflows/:id/trust-level",
    "file": "src/automation/automation.controller.ts",
    "line": 60,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/automation/workflows/:id/trust-level",
    "file": "src/automation/automation.controller.ts",
    "line": 60,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/automation/workflows/:id/trust-level",
    "file": "src/automation/automation.controller.ts",
    "line": 60,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/automation/runs",
    "file": "src/automation/automation.controller.ts",
    "line": 76,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetRunsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/automation/runs",
    "file": "src/automation/automation.controller.ts",
    "line": 76,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetRunsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/automation/runs",
    "file": "src/automation/automation.controller.ts",
    "line": 76,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetRunsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/automation/pending-approvals",
    "file": "src/automation/automation.controller.ts",
    "line": 83,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetPendingApprovalsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/automation/pending-approvals",
    "file": "src/automation/automation.controller.ts",
    "line": 83,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetPendingApprovalsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/automation/pending-approvals",
    "file": "src/automation/automation.controller.ts",
    "line": 83,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": [
      "Query: GetPendingApprovalsQueryDto"
    ]
  },
  {
    "method": "POST",
    "path": "/automation/pending-approvals/:id/approve",
    "file": "src/automation/automation.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/automation/pending-approvals/:id/approve",
    "file": "src/automation/automation.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/automation/pending-approvals/:id/approve",
    "file": "src/automation/automation.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/automation/pending-approvals/:id/reject",
    "file": "src/automation/automation.controller.ts",
    "line": 103,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/automation/pending-approvals/:id/reject",
    "file": "src/automation/automation.controller.ts",
    "line": 103,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/automation/pending-approvals/:id/reject",
    "file": "src/automation/automation.controller.ts",
    "line": 103,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"automation.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/banners",
    "file": "src/banners/banners.controller.ts",
    "line": 40,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/banners",
    "file": "src/banners/banners.controller.ts",
    "line": 40,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/banners/admin",
    "file": "src/banners/banners.controller.ts",
    "line": 53,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/banners/admin",
    "file": "src/banners/banners.controller.ts",
    "line": 53,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/banners",
    "file": "src/banners/banners.controller.ts",
    "line": 71,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/banners",
    "file": "src/banners/banners.controller.ts",
    "line": 71,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/banners/:id",
    "file": "src/banners/banners.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/banners/:id",
    "file": "src/banners/banners.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/banners/:id",
    "file": "src/banners/banners.controller.ts",
    "line": 117,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/v1/banners/:id",
    "file": "src/banners/banners.controller.ts",
    "line": 117,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/bundles",
    "file": "src/bundles/admin-bundles.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/bundles",
    "file": "src/bundles/admin-bundles.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query: PaginationDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/bundles/:id",
    "file": "src/bundles/admin-bundles.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/bundles/:id",
    "file": "src/bundles/admin-bundles.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/bundles/:id",
    "file": "src/bundles/admin-bundles.controller.ts",
    "line": 65,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/bundles",
    "file": "src/bundles/bundles.controller.ts",
    "line": 11,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Query: PaginationDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/bundles/:id",
    "file": "src/bundles/bundles.controller.ts",
    "line": 17,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/carts/abandoned",
    "file": "src/cart-sessions/admin-cart-sessions.controller.ts",
    "line": 17,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/cart/sync",
    "file": "src/cart-sessions/cart-sessions.controller.ts",
    "line": 13,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/categories",
    "file": "src/categories/categories.controller.ts",
    "line": 34,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/categories",
    "file": "src/categories/categories.controller.ts",
    "line": 84,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/categories/:id",
    "file": "src/categories/categories.controller.ts",
    "line": 103,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/categories/:id",
    "file": "src/categories/categories.controller.ts",
    "line": 122,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/collections",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/collections/:id",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/collections",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 54,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/collections/:id",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 63,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/collections/:id",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 73,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/collections/:id/products/:productId",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 79,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/collections/:id/products/:productId",
    "file": "src/collections/admin-collections.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/collections",
    "file": "src/collections/collections.controller.ts",
    "line": 11,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/collections/:slug",
    "file": "src/collections/collections.controller.ts",
    "line": 27,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Param(slug): string"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/coupons",
    "file": "src/coupons/admin-coupons.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/coupons",
    "file": "src/coupons/admin-coupons.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query: PaginationDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/coupons/:id",
    "file": "src/coupons/admin-coupons.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/coupons/:id",
    "file": "src/coupons/admin-coupons.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/coupons/:id",
    "file": "src/coupons/admin-coupons.controller.ts",
    "line": 65,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/coupons/validate",
    "file": "src/coupons/coupons.controller.ts",
    "line": 11,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: ValidateCouponDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/customers",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Query: GetCustomersQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Query: GetCustomersQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/customers/email/:email",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 40,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Param(email): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers/email/:email",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 40,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Param(email): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/customers/:id/orders",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers/:id/orders",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/customers/:id/activity",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 61,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers/:id/activity",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 61,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/customers/:id",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 73,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers/:id",
    "file": "src/customers/admin-customers.controller.ts",
    "line": 73,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/data-deletion-requests",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": [
      "Query: ListDeletionRequestsQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/data-deletion-requests",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": [
      "Query: ListDeletionRequestsQueryDto"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/admin/data-deletion-requests/:id/approve",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/data-deletion-requests/:id/approve",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/admin/data-deletion-requests/:id/reject",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 46,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/data-deletion-requests/:id/reject",
    "file": "src/customers/admin-data-deletion-requests.controller.ts",
    "line": 46,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"users.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/me/deletion-request",
    "file": "src/customers/me-deletion.controller.ts",
    "line": 15,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/me/deletion-request",
    "file": "src/customers/me-deletion.controller.ts",
    "line": 15,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/overview",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 18,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/recent-orders",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 25,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/recent-customers",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 32,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/low-stock",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 39,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/order-status-stats",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 46,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/payment-status-stats",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 53,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/top-products",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 60,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/sales-report",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 67,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/sales-by-category",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 74,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/dashboard/sales-by-region",
    "file": "src/dashboard/admin-dashboard.controller.ts",
    "line": 81,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "POST",
    "path": "/api/admin/expenses",
    "file": "src/expenses/expenses.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: CreateExpenseDto",
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/expenses",
    "file": "src/expenses/expenses.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: CreateExpenseDto",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/expenses",
    "file": "src/expenses/expenses.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Query: ListExpensesQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/expenses",
    "file": "src/expenses/expenses.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Query: ListExpensesQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/expenses/monthly-total",
    "file": "src/expenses/expenses.controller.ts",
    "line": 50,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/expenses/monthly-total",
    "file": "src/expenses/expenses.controller.ts",
    "line": 50,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 63,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 63,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 71,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 71,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 83,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/expenses/:id",
    "file": "src/expenses/expenses.controller.ts",
    "line": 83,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/orders/export",
    "file": "src/export/export.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/orders/export",
    "file": "src/export/export.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/orders/export",
    "file": "src/export/export.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/orders/export",
    "file": "src/export/export.controller.ts",
    "line": 35,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/customers/export",
    "file": "src/export/export.controller.ts",
    "line": 64,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/customers/export",
    "file": "src/export/export.controller.ts",
    "line": 64,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/customers/export",
    "file": "src/export/export.controller.ts",
    "line": 64,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/customers/export",
    "file": "src/export/export.controller.ts",
    "line": 64,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/payments/export",
    "file": "src/export/export.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/payments/export",
    "file": "src/export/export.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/payments/export",
    "file": "src/export/export.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/payments/export",
    "file": "src/export/export.controller.ts",
    "line": 93,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"customers.view\"",
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/health",
    "file": "src/health/health.controller.ts",
    "line": 50,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/health",
    "file": "src/health/health.controller.ts",
    "line": 50,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/health/detailed",
    "file": "src/health/health.controller.ts",
    "line": 50,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/health/backup",
    "file": "src/health/health.controller.ts",
    "line": 86,
    "guards": [
      "FullAdminGuard",
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/test",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 22,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Body: TestGoogleSheetsDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/test",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 22,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Body: TestGoogleSheetsDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/export/orders",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/export/orders",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/export/customers",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/export/customers",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/export/products",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 45,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/export/products",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 45,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/export/inventory",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 52,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/export/inventory",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 52,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/integrations/google-sheets/export/sales-report",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 59,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/integrations/google-sheets/export/sales-report",
    "file": "src/integrations/admin-integrations.controller.ts",
    "line": 59,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/meta/conversations",
    "file": "src/integrations/admin-meta.controller.ts",
    "line": 17,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/meta/conversations/:id/messages",
    "file": "src/integrations/admin-meta.controller.ts",
    "line": 32,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/excel/export/products",
    "file": "src/integrations/excel.controller.ts",
    "line": 37,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/excel/export/orders",
    "file": "src/integrations/excel.controller.ts",
    "line": 52,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/excel/export/customers",
    "file": "src/integrations/excel.controller.ts",
    "line": 67,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/excel/import/products",
    "file": "src/integrations/excel.controller.ts",
    "line": 82,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/excel/import/inventory",
    "file": "src/integrations/excel.controller.ts",
    "line": 98,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/integrations/meta/webhook",
    "file": "src/integrations/meta.controller.ts",
    "line": 12,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/integrations/meta/webhook",
    "file": "src/integrations/meta.controller.ts",
    "line": 23,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: any"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/internal-notes",
    "file": "src/internal-notes/internal-notes.controller.ts",
    "line": 39,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/internal-notes",
    "file": "src/internal-notes/internal-notes.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/internal-notes/:id",
    "file": "src/internal-notes/internal-notes.controller.ts",
    "line": 61,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/internal-notes/:id",
    "file": "src/internal-notes/internal-notes.controller.ts",
    "line": 69,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/internal-notes/:id",
    "file": "src/internal-notes/internal-notes.controller.ts",
    "line": 81,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/message-templates",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 25,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/message-templates",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 25,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/message-templates",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 25,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/message-templates/:id",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/message-templates/:id",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/message-templates/:id",
    "file": "src/message-templates/message-templates.controller.ts",
    "line": 33,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard"
    ],
    "roles": [],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/notifications/whatsapp/test",
    "file": "src/notifications/admin-notifications.controller.ts",
    "line": 32,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: TestWhatsAppDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/notifications/whatsapp/test",
    "file": "src/notifications/admin-notifications.controller.ts",
    "line": 32,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: TestWhatsAppDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/admin/notifications/test-alert",
    "file": "src/notifications/admin-notifications.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: TestAlertDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/notifications/test-alert",
    "file": "src/notifications/admin-notifications.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: TestAlertDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/integrations/whatsapp/webhook",
    "file": "src/notifications/whatsapp.controller.ts",
    "line": 12,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/integrations/whatsapp/webhook",
    "file": "src/notifications/whatsapp.controller.ts",
    "line": 23,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: any"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/orders",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/orders",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 49,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/orders/:id",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 72,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/orders/:id",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 72,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.view\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/admin/orders/:id/status",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 81,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.update_status\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/orders/:id/status",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 81,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.update_status\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/admin/orders/:id/shipping",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 94,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.update_status\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/orders/:id/shipping",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 94,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.update_status\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/orders/:id/refund",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 107,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.refund\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/orders/:id/refund",
    "file": "src/orders/admin-orders.controller.ts",
    "line": 107,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"orders.refund\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/internal/expire-reservations",
    "file": "src/orders/internal-orders.controller.ts",
    "line": 40,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/internal/reconcile-paymob",
    "file": "src/orders/internal-orders.controller.ts",
    "line": 80,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/orders",
    "file": "src/orders/orders.controller.ts",
    "line": 51,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Body: CreateOrderDto",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/orders/:orderNumber",
    "file": "src/orders/orders.controller.ts",
    "line": 67,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/orders/:orderNumber/cancel",
    "file": "src/orders/orders.controller.ts",
    "line": 96,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/create-checkout-session",
    "file": "src/payment/payment.controller.ts",
    "line": 47,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/paymob-webhook",
    "file": "src/payment/payment.controller.ts",
    "line": 86,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/webhook",
    "file": "src/payment/payment.controller.ts",
    "line": 103,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/stripe-webhook",
    "file": "src/payment/payment.controller.ts",
    "line": 117,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/refund",
    "file": "src/payment/payment.controller.ts",
    "line": 133,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Body: RefundPaymentDto"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/reconcile",
    "file": "src/payment/payment.controller.ts",
    "line": 146,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Query"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/products/reorder",
    "file": "src/products/admin-products.controller.ts",
    "line": 45,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/products",
    "file": "src/products/admin-products.controller.ts",
    "line": 56,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.view\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/products/:id",
    "file": "src/products/admin-products.controller.ts",
    "line": 81,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.view\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/products/:productId/variants",
    "file": "src/products/admin-products.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/products/:productId/variants/:variantId",
    "file": "src/products/admin-products.controller.ts",
    "line": 107,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/products/:productId/variants/:variantId",
    "file": "src/products/admin-products.controller.ts",
    "line": 133,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/products/:productId/images",
    "file": "src/products/admin-products.controller.ts",
    "line": 157,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/products/:productId/images/:imageId",
    "file": "src/products/admin-products.controller.ts",
    "line": 170,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/products/:productId/images/:imageId",
    "file": "src/products/admin-products.controller.ts",
    "line": 189,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.edit\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/products/:productId/price-history",
    "file": "src/products/admin-products.controller.ts",
    "line": 203,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"products.view\""
    ],
    "dtos": [
      "Param(productId): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/products",
    "file": "src/products/products.controller.ts",
    "line": 35,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/products/:slug",
    "file": "src/products/products.controller.ts",
    "line": 86,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Param(slug): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/v1/products/reorder",
    "file": "src/products/products.controller.ts",
    "line": 94,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/products",
    "file": "src/products/products.controller.ts",
    "line": 107,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/products/:id",
    "file": "src/products/products.controller.ts",
    "line": 128,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/products/:id",
    "file": "src/products/products.controller.ts",
    "line": 147,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/referrals/my-code",
    "file": "src/referrals/referrals.controller.ts",
    "line": 23,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/referrals/validate",
    "file": "src/referrals/referrals.controller.ts",
    "line": 31,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/reviews",
    "file": "src/reviews/admin-reviews.controller.ts",
    "line": 31,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/reviews/:id/approve",
    "file": "src/reviews/admin-reviews.controller.ts",
    "line": 45,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/reviews/:id",
    "file": "src/reviews/admin-reviews.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/products/:productId/reviews",
    "file": "src/reviews/reviews.controller.ts",
    "line": 23,
    "guards": [
      "OptionalJwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/products/:productId/reviews",
    "file": "src/reviews/reviews.controller.ts",
    "line": 40,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/admin/maintenance-mode",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 27,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/maintenance-mode",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 27,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PUT",
    "path": "/api/admin/maintenance-mode",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 34,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateMaintenanceModeDto"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/v1/admin/maintenance-mode",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 34,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateMaintenanceModeDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/settings/enforce-2fa",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/settings/enforce-2fa",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 41,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PUT",
    "path": "/api/admin/settings/enforce-2fa",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateEnforce2FaDto"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/v1/admin/settings/enforce-2fa",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 48,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateEnforce2FaDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/settings/alerts",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/settings/alerts",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 55,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PUT",
    "path": "/api/admin/settings/alerts",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 62,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateAlertSettingsDto"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/v1/admin/settings/alerts",
    "file": "src/settings/admin-settings.controller.ts",
    "line": 62,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateAlertSettingsDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/settings/site/public",
    "file": "src/settings/site-settings.controller.ts",
    "line": 21,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/settings/site",
    "file": "src/settings/site-settings.controller.ts",
    "line": 28,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/settings/site",
    "file": "src/settings/site-settings.controller.ts",
    "line": 39,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: UpdateSiteSettingsDto"
    ]
  },
  {
    "method": "GET",
    "path": "/shipping-zones",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 34,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/shipping-zones",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 34,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/shipping-zones/admin",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 47,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/shipping-zones/admin",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 47,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/shipping-zones",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 66,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/shipping-zones",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 66,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/shipping-zones/:id",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/shipping-zones/:id",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 90,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/shipping-zones/:id/deactivate",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 115,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/shipping-zones/:id/deactivate",
    "file": "src/shipping-zones/shipping-zones.controller.ts",
    "line": 115,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/static-pages/:slug",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 30,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Param(slug): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/static-pages/:slug",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 30,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Param(slug): string"
    ]
  },
  {
    "method": "GET",
    "path": "/static-pages",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/static-pages",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 38,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/static-pages/:id",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 51,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/static-pages/:id",
    "file": "src/static-pages/static-pages.controller.ts",
    "line": 51,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/admin/suppliers",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: CreateSupplierDto",
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/admin/suppliers",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Body: CreateSupplierDto",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/suppliers",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Query: ListSuppliersQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/suppliers",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Query: ListSuppliersQueryDto"
    ]
  },
  {
    "method": "GET",
    "path": "/api/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 50,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "GET",
    "path": "/api/v1/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 50,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string"
    ]
  },
  {
    "method": "PATCH",
    "path": "/api/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 58,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 58,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 70,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/v1/admin/suppliers/:id",
    "file": "src/suppliers/suppliers.controller.ts",
    "line": 70,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"settings.manage\""
    ],
    "dtos": [
      "Param(id): string",
      "Req"
    ]
  },
  {
    "method": "GET",
    "path": "/system-lists/types",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/system-lists/types",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 36,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/system-lists/:listTypeKey/items",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 52,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/system-lists/:listTypeKey/items",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 52,
    "guards": [],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/system-lists/:listTypeKey/items",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 72,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/system-lists/:listTypeKey/items",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 72,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/system-lists/items/:id",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 99,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/system-lists/items/:id",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 99,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/system-lists/items/:id/deactivate",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 121,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "PATCH",
    "path": "/api/v1/system-lists/items/:id/deactivate",
    "file": "src/system-lists/system-lists.controller.ts",
    "line": 121,
    "guards": [
      "JwtAuthGuard",
      "PermissionsGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [
      "\"lists.manage\""
    ],
    "dtos": []
  },
  {
    "method": "POST",
    "path": "/api/v1/upload/image",
    "file": "src/upload/upload.controller.ts",
    "line": 28,
    "guards": [
      "JwtAuthGuard",
      "RolesGuard"
    ],
    "roles": [
      "\"ADMIN\""
    ],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "GET",
    "path": "/api/v1/wishlist",
    "file": "src/wishlist/wishlist.controller.ts",
    "line": 26,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": [
      "Req"
    ]
  },
  {
    "method": "POST",
    "path": "/api/v1/wishlist",
    "file": "src/wishlist/wishlist.controller.ts",
    "line": 32,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  },
  {
    "method": "DELETE",
    "path": "/api/v1/wishlist/:productId",
    "file": "src/wishlist/wishlist.controller.ts",
    "line": 43,
    "guards": [
      "JwtAuthGuard"
    ],
    "roles": [],
    "permissions": [],
    "dtos": []
  }
]
```

---

## Section C: Notes on Uncertainty

1. **External Frontend Routes:** This report is generated strictly from the `rive-backend` repository codebase. API route usage in `rive-admin` or `rive-storefront` clients cannot be directly verified from this repository alone and must be diffed against Section B JSON.
2. **Third-Party Service Credentials:** Environment variables (`PAYMOB_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `CLOUDINARY_CLOUD_NAME`, `EMAIL_PROVIDER_API_KEY`, `SENTRY_DSN`) are required for live external communication. When absent in local or test environments, integrations either log warnings (e.g. EmailService, GoogleSheetsService) or throw runtime validation errors at startup (`validateEnvironment` in `src/main.ts`).
3. **Dynamic Throttler Overrides:** Some endpoints specify `@Throttle(...)` overrides (e.g., auth register/login/forgot-password). Global defaults (10 requests/min) apply to all other endpoints.
