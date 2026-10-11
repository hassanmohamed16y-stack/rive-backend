# Backend API Audit Report

**Date:** October 2024
**Scope:** RIVE Luxury Store Backend API (`rive-backend`)
**Branch:** `jules-14146037797467242642-33bbe953`

---

## 1. Route Table

Below is the complete route table for every HTTP endpoint defined in the NestJS controllers. Global prefix in `src/main.ts` is not set via `app.setGlobalPrefix()`, so full paths are defined directly in `@Controller()` decorators. Note that where controller paths are arrays (e.g. `["shipping-zones", "api/v1/shipping-zones"]`), both aliases are listed. All money fields across the codebase are returned as standard JavaScript floating-point numbers in **Egyptian Pounds (EGP)** unless explicitly noted (e.g. Paymob API requests convert to piasters internally, but response models store numbers in EGP).

| HTTP Method | Full Path | Controller (`file:line`) | Access Control / Auth | Request DTO Fields & Validation Rules | Real Response Shape (Keys & Types) | Error Status Codes |
|---|---|---|---|---|---|---|
| GET | `/api/v1/analytics/dashboard` | `src/analytics/analytics.controller.ts:16` | User JWT (Admin with `analytics.view`) | Query: optional `startDate`, `endDate` (ISO date strings, max 50 chars) | `{ totalRevenue: number, totalOrders: number, averageOrderValue: number, topProducts: Array<{ id: string, name: string, totalQuantity: number, revenue: number }> }` | 400, 401, 403 |
| GET | `/api/v1/admin/audit-logs` | `src/audit-log/audit-log.controller.ts:28` | User JWT (Admin with `logs.view`) | Query: `page` (int >= 1, default 1), `limit` (int 1..100, default 20), `userId` (string), `action` (string), `entityType` (string), `entityId` (string), `startDate` (ISO string), `endDate` (ISO string) | `{ data: Array<{ id: string, userId: string \| null, userEmail: string \| null, userName: string \| null, action: string, entityType: string, entityId: string, metadata: object \| null, ipAddress: string \| null, userAgent: string \| null, createdAt: string (ISO) }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| GET | `/api/v1/admin/users` | `src/auth/admin-users.controller.ts:39` | User JWT (Admin with `settings.manage`) | Query: `page` (int >= 1), `limit` (int 1..100), `search` (string max 100), `roleId` (string max 128), `isBlocked` (boolean string) | `{ data: Array<{ id: string, email: string, name: string \| null, roleId: string \| null, isBlocked: boolean, createdAt: string, role: { id: string, name: string } \| null }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| POST | `/api/v1/admin/users` | `src/auth/admin-users.controller.ts:50` | User JWT (Admin with `settings.manage`) | Body: `email` (email, 3..254 chars), `password` (string 8..128 chars), `name` (string 2..120 chars), `roleId` (string 10..128 chars) | `{ id: string, email: string, name: string, roleId: string, isBlocked: boolean, createdAt: string }` | 400, 401, 403, 409 |
| GET | `/api/v1/admin/users/:id` | `src/auth/admin-users.controller.ts:60` | User JWT (Admin with `settings.manage`) | Path: `id` (string) | `{ id: string, email: string, name: string \| null, roleId: string \| null, isBlocked: boolean, createdAt: string, role: { id: string, name: string } \| null }` | 401, 403, 404 |
| PATCH | `/api/v1/admin/users/:id` | `src/auth/admin-users.controller.ts:69` | User JWT (Admin with `settings.manage`) | Path: `id` (string). Body: `name` (optional string 2..120), `roleId` (optional string 10..128), `isBlocked` (optional boolean), `password` (optional string 8..128) | `{ id: string, email: string, name: string, roleId: string, isBlocked: boolean, updatedAt: string }` | 400, 401, 403, 404 |
| POST | `/api/v1/auth/register` | `src/auth/auth.controller.ts:41` | Public | Body: `email` (email, 3..254 chars), `password` (string 8..128 chars), `name` (optional string 2..120 chars) | `{ user: { id: string, email: string, name: string \| null, roleName: string }, accessToken: string, refreshToken: string }` | 400, 409 |
| POST | `/api/v1/auth/login` | `src/auth/auth.controller.ts:48` | Public | Body: `email` (email, 3..254 chars), `password` (string 8..128 chars) | `{ user: { id: string, email: string, name: string \| null, roleName: string, permissions: string[] }, accessToken: string, refreshToken: string }` | 400, 401, 403 |
| POST | `/api/v1/auth/refresh-token` | `src/auth/auth.controller.ts:55` | Public | Body: `refreshToken` (non-empty string) | `{ accessToken: string, refreshToken: string }` | 400, 401, 403 |
| POST | `/api/v1/auth/forgot-password` | `src/auth/auth.controller.ts:62` | Public | Body: `email` (email, 3..254 chars) | `{ message: string }` | 400, 429 |
| POST | `/api/v1/auth/reset-password` | `src/auth/auth.controller.ts:68` | Public | Body: `token` (non-empty string), `newPassword` (string 8..128 chars) | `{ message: string }` | 400 |
| POST | `/api/v1/auth/confirm-email-verification` | `src/auth/auth.controller.ts:75` | Public | Body: `token` (non-empty string) | `{ message: string }` | 400 |
| POST | `/api/v1/auth/two-factor/enable` | `src/auth/auth.controller.ts:83` | User JWT | Body: `password` (string 8..128 chars) | `{ qrCodeUrl: string, secret: string }` | 400, 401 |
| POST | `/api/v1/auth/two-factor/verify` | `src/auth/auth.controller.ts:93` | User JWT | Body: `code` (string 6 digits) | `{ message: string, recoveryCodes: string[] }` | 400, 401 |
| POST | `/api/v1/auth/two-factor/disable` | `src/auth/auth.controller.ts:103` | User JWT | Body: `password` (string 8..128 chars), `code` (string 6 digits) | `{ message: string }` | 400, 401 |
| GET | `/api/v1/permissions` & `/permissions` | `src/auth/permissions.controller.ts:28` | User JWT (Admin with `settings.manage`) | None | `Array<{ id: string, name: string, description: string \| null }>` | 401, 403 |
| POST | `/api/v1/permissions` & `/permissions` | `src/auth/permissions.controller.ts:36` | User JWT (Admin with `settings.manage`) | Body: `name` (string 2..100 chars), `description` (optional string max 255 chars) | `{ id: string, name: string, description: string \| null }` | 400, 401, 403, 409 |
| GET | `/api/v1/roles` & `/roles` | `src/auth/roles.controller.ts:34` | User JWT (Admin with `settings.manage`) | None | `Array<{ id: string, name: string, description: string \| null, permissions: Array<{ permission: { id: string, name: string } }> }>` | 401, 403 |
| POST | `/api/v1/roles` & `/roles` | `src/auth/roles.controller.ts:42` | User JWT (Admin with `settings.manage`) | Body: `name` (string 2..100 chars), `description` (optional string max 255 chars) | `{ id: string, name: string, description: string \| null }` | 400, 401, 403, 409 |
| PUT | `/api/v1/roles/:id/permissions` & `/roles/:id/permissions` | `src/auth/roles.controller.ts:51` | User JWT (Admin with `settings.manage`) | Path: `id` (string). Body: `permissionIds` (array of strings 10..128 chars) | `{ message: string }` | 400, 401, 403, 404 |
| GET | `/api/v1/users/me` & `/users/me` | `src/auth/users.controller.ts:33` | User JWT | None | `{ id: string, email: string, name: string \| null, roleName: string, permissions: string[], twoFactorEnabled: boolean }` | 401 |
| PATCH | `/api/v1/users/me` & `/users/me` | `src/auth/users.controller.ts:40` | User JWT | Body: `name` (optional string 2..120), `email` (optional email 3..254) | `{ id: string, email: string, name: string \| null }` | 400, 401, 409 |
| POST | `/api/v1/users/me/change-password` & `/users/me/change-password` | `src/auth/users.controller.ts:48` | User JWT | Body: `currentPassword` (string 8..128), `newPassword` (string 8..128) | `{ message: string }` | 400, 401 |
| GET | `/automation`, `/api/v1/automation`, `/api/v1/admin/automation` | `src/automation/automation.controller.ts:42` | User JWT (Admin with `settings.manage`) | None | `Array<{ id: string, key: string, name: string, enabled: boolean, trigger: string, actions: object, createdAt: string, updatedAt: string }>` | 401, 403 |
| POST | `/automation/rules`, `/api/v1/automation/rules`, `/api/v1/admin/automation/rules` | `src/automation/automation.controller.ts:50` | User JWT (Admin with `settings.manage`) | Body: `key` (string), `name` (string), `enabled` (boolean), `trigger` (string), `actions` (object) | `{ id: string, key: string, name: string, enabled: boolean, trigger: string, actions: object, createdAt: string, updatedAt: string }` | 400, 401, 403 |
| PATCH | `/automation/rules/:id`, `/api/v1/automation/rules/:id`, `/api/v1/admin/automation/rules/:id` | `src/automation/automation.controller.ts:60` | User JWT (Admin with `settings.manage`) | Path: `id` (string). Body: `name` (optional string), `enabled` (optional boolean), `trigger` (optional string), `actions` (optional object) | `{ id: string, key: string, name: string, enabled: boolean, trigger: string, actions: object, updatedAt: string }` | 400, 401, 403, 404 |
| GET | `/banners` & `/api/v1/banners` | `src/banners/banners.controller.ts:43` | Public | None | `Array<{ id: string, title: string, subtitle: string \| null, imageUrl: string, linkUrl: string \| null, isActive: boolean, sortOrder: number }>` | None |
| POST | `/banners` & `/api/v1/banners` | `src/banners/banners.controller.ts:50` | User JWT (Admin with `settings.manage`) | Body: `title` (string max 120), `subtitle` (optional string max 200), `imageUrl` (string url max 500), `linkUrl` (optional string max 500), `isActive` (optional boolean), `sortOrder` (optional int) | `{ id: string, title: string, subtitle: string \| null, imageUrl: string, linkUrl: string \| null, isActive: boolean, sortOrder: number }` | 400, 401, 403 |
| PATCH | `/banners/:id` & `/api/v1/banners/:id` | `src/banners/banners.controller.ts:60` | User JWT (Admin with `settings.manage`) | Path: `id`. Body: optional fields as above | `{ id: string, title: string, subtitle: string \| null, imageUrl: string, linkUrl: string \| null, isActive: boolean, sortOrder: number }` | 400, 401, 403, 404 |
| DELETE | `/banners/:id` & `/api/v1/banners/:id` | `src/banners/banners.controller.ts:70` | User JWT (Admin with `settings.manage`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/admin/bundles` | `src/bundles/admin-bundles.controller.ts:37` | User JWT (Admin with `products.view`) | None | `Array<{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean, items: Array<{ id: string, quantity: number, product: object }> }>` | 401, 403 |
| POST | `/api/v1/admin/bundles` | `src/bundles/admin-bundles.controller.ts:44` | User JWT (Admin with `products.edit`) | Body: `name` (string max 120), `slug` (string max 120), `discountPercentage` (number 0..100), `isActive` (optional boolean), `items` (array of `{ productId: string, quantity: int >= 1 }`) | `{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean }` | 400, 401, 403 |
| GET | `/api/v1/admin/bundles/:id` | `src/bundles/admin-bundles.controller.ts:53` | User JWT (Admin with `products.view`) | Path: `id` | `{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean, items: Array<object> }` | 401, 403, 404 |
| PATCH | `/api/v1/admin/bundles/:id` | `src/bundles/admin-bundles.controller.ts:61` | User JWT (Admin with `products.edit`) | Path: `id`. Body: optional bundle fields | `{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean }` | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/bundles/:id` | `src/bundles/admin-bundles.controller.ts:70` | User JWT (Admin with `products.edit`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/bundles` | `src/bundles/bundles.controller.ts:14` | Public | None | `Array<{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean, items: Array<object> }>` | None |
| GET | `/api/v1/bundles/:slug` | `src/bundles/bundles.controller.ts:20` | Public | Path: `slug` | `{ id: string, name: string, slug: string, discountPercentage: number, isActive: boolean, items: Array<object> }` | 404 |
| GET | `/api/v1/admin/carts/abandoned` | `src/cart-sessions/admin-cart-sessions.controller.ts:21` | User JWT (Admin with `orders.view`) | Query: `page` (int >= 1), `limit` (int 1..100), `minPrice` (number string), `maxPrice` (number string) | `{ data: Array<{ id: string, sessionId: string, customerEmail: string \| null, customerPhone: string \| null, items: object, subtotal: number, updatedAt: string }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| GET | `/api/v1/cart/:sessionId` | `src/cart-sessions/cart-sessions.controller.ts:14` | Public | Path: `sessionId` | `{ id: string, sessionId: string, customerEmail: string \| null, customerPhone: string \| null, items: object, subtotal: number, updatedAt: string }` | 404 |
| POST | `/api/v1/cart/sync` | `src/cart-sessions/cart-sessions.controller.ts:20` | Public | Body: `sessionId` (string), `customerEmail` (optional email), `customerPhone` (optional string), `items` (array of objects), `subtotal` (number >= 0) | `{ id: string, sessionId: string, subtotal: number, updatedAt: string }` | 400 |
| GET | `/api/v1/categories` | `src/categories/categories.controller.ts:40` | Public | Query: `page` (int >= 1), `limit` (int 1..100), `search` (string max 200) | `Array<{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, createdAt: string, updatedAt: string }>` (Note: Returns bare array despite taking pagination params) | 400 |
| GET | `/api/v1/categories/:slug` | `src/categories/categories.controller.ts:48` | Public | Path: `slug` | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean }` | 404 |
| POST | `/api/v1/categories` | `src/categories/categories.controller.ts:57` | User JWT (Admin with `products.edit`) | Body: `name` (string 2..120), `slug` (optional string 2..120), `description` (optional string max 1000), `imageUrl` (optional string url max 500), `isActive` (optional boolean) | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean }` | 400, 401, 403, 409 |
| PATCH | `/api/v1/categories/:id` | `src/categories/categories.controller.ts:68` | User JWT (Admin with `products.edit`) | Path: `id`. Body: optional category fields | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean }` | 400, 401, 403, 404 |
| DELETE | `/api/v1/categories/:id` | `src/categories/categories.controller.ts:78` | User JWT (Admin with `products.edit`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/admin/collections` | `src/collections/admin-collections.controller.ts:40` | User JWT (Admin with `products.view`) | None | `Array<{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, sortOrder: number }>` | 401, 403 |
| POST | `/api/v1/admin/collections` | `src/collections/admin-collections.controller.ts:47` | User JWT (Admin with `products.edit`) | Body: `name` (string 2..120), `slug` (optional string 2..120), `description` (optional string max 1000), `imageUrl` (optional string url max 500), `isActive` (optional boolean), `sortOrder` (optional int) | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, sortOrder: number }` | 400, 401, 403 |
| GET | `/api/v1/admin/collections/:id` | `src/collections/admin-collections.controller.ts:56` | User JWT (Admin with `products.view`) | Path: `id` | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, sortOrder: number }` | 401, 403, 404 |
| PATCH | `/api/v1/admin/collections/:id` | `src/collections/admin-collections.controller.ts:64` | User JWT (Admin with `products.edit`) | Path: `id`. Body: optional collection fields | `{ id: string, name: string, slug: string }` | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/collections/:id` | `src/collections/admin-collections.controller.ts:73` | User JWT (Admin with `products.edit`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/collections` | `src/collections/collections.controller.ts:14` | Public | Query: `page` (int >= 1), `limit` (int 1..100), `search` (string max 200) | `Array<{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, sortOrder: number }>` (Note: Returns bare array despite taking pagination params) | 400 |
| GET | `/api/v1/collections/:slug` | `src/collections/collections.controller.ts:22` | Public | Path: `slug` | `{ id: string, name: string, slug: string, description: string \| null, imageUrl: string \| null, isActive: boolean, sortOrder: number }` | 404 |
| GET | `/api/v1/admin/coupons` | `src/coupons/admin-coupons.controller.ts:38` | User JWT (Admin with `settings.manage`) | None | `Array<{ id: string, code: string, discountType: string, discountAmount: number, minOrderAmount: number \| null, maxDiscountAmount: number \| null, usageLimit: number \| null, usageCount: number, expiresAt: string \| null, isActive: boolean }>` | 401, 403 |
| POST | `/api/v1/admin/coupons` | `src/coupons/admin-coupons.controller.ts:45` | User JWT (Admin with `settings.manage`) | Body: `code` (string 2..50), `discountType` (enum `PERCENTAGE`, `FIXED_AMOUNT`), `discountAmount` (number >= 0), `minOrderAmount` (optional number >= 0), `maxDiscountAmount` (optional number >= 0), `usageLimit` (optional int >= 1), `expiresAt` (optional ISO date string), `isActive` (optional boolean) | `{ id: string, code: string, discountType: string, discountAmount: number, minOrderAmount: number \| null, maxDiscountAmount: number \| null, usageLimit: number \| null, usageCount: number, expiresAt: string \| null, isActive: boolean }` | 400, 401, 403, 409 |
| GET | `/api/v1/admin/coupons/:id` | `src/coupons/admin-coupons.controller.ts:54` | User JWT (Admin with `settings.manage`) | Path: `id` | Coupon object | 401, 403, 404 |
| PATCH | `/api/v1/admin/coupons/:id` | `src/coupons/admin-coupons.controller.ts:62` | User JWT (Admin with `settings.manage`) | Path: `id`. Body: optional coupon fields | Coupon object | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/coupons/:id` | `src/coupons/admin-coupons.controller.ts:71` | User JWT (Admin with `settings.manage`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| POST | `/api/v1/coupons/validate` | `src/coupons/coupons.controller.ts:12` | Public | Body: `code` (non-empty string), `subtotal` (number >= 0) | `{ valid: boolean, code: string, discountType: "PERCENTAGE" \| "FIXED_AMOUNT", discountAmount: number, calculatedDiscount: number, finalSubtotal: number }` | 400 |
| GET | `/api/admin/customers` & `/api/v1/admin/customers` | `src/customers/admin-customers.controller.ts:41` | User JWT (Admin with `customers.view`) | Query: `page` (int >= 1), `limit` (int 1..100), `search` (string max 200), `tier` (enum `NEW`, `REGULAR`, `VIP`), `sortBy` (enum `ordersCount`, `totalSpent`, `createdAt`), `sortOrder` (enum `asc`, `desc`) | `{ data: Array<{ id: string, email: string, name: string \| null, phone: string \| null, ordersCount: number, totalSpent: number, tier: "NEW" \| "REGULAR" \| "VIP", isBlocked: boolean, createdAt: string }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| GET | `/api/admin/customers/:id` & `/api/v1/admin/customers/:id` | `src/customers/admin-customers.controller.ts:51` | User JWT (Admin with `customers.view`) | Path: `id` | `{ id: string, email: string, name: string \| null, phone: string \| null, ordersCount: number, totalSpent: number, tier: string, isBlocked: boolean, orders: Array<object>, createdAt: string }` | 401, 403, 404 |
| PATCH | `/api/admin/customers/:id/block` & `/api/v1/admin/customers/:id/block` | `src/customers/admin-customers.controller.ts:60` | User JWT (Admin with `customers.update`) | Path: `id` | `{ id: string, email: string, isBlocked: true }` | 401, 403, 404 |
| PATCH | `/api/admin/customers/:id/unblock` & `/api/v1/admin/customers/:id/unblock` | `src/customers/admin-customers.controller.ts:69` | User JWT (Admin with `customers.update`) | Path: `id` | `{ id: string, email: string, isBlocked: false }` | 401, 403, 404 |
| DELETE | `/api/admin/customers/:id` & `/api/v1/admin/customers/:id` | `src/customers/admin-customers.controller.ts:78` | User JWT (Admin with `customers.update`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| POST | `/api/admin/customers/:id/send-email` & `/api/v1/admin/customers/:id/send-email` | `src/customers/admin-customers.controller.ts:87` | User JWT (Admin with `customers.update`) | Path: `id`. Body: `subject` (string 1..200), `body` (string 1..5000) | `{ success: boolean, message: string }` | 400, 401, 403, 404 |
| GET | `/api/admin/data-deletion-requests` & `/api/v1/admin/data-deletion-requests` | `src/customers/admin-data-deletion-requests.controller.ts:33` | User JWT (Admin with `customers.view`) | Query: `page` (int >= 1), `limit` (int 1..100), `status` (enum `PENDING`, `APPROVED`, `REJECTED`) | `{ data: Array<{ id: string, userId: string, userEmail: string, status: string, reason: string \| null, createdAt: string }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| PATCH | `/api/admin/data-deletion-requests/:id/approve` & `/api/v1/admin/data-deletion-requests/:id/approve` | `src/customers/admin-data-deletion-requests.controller.ts:43` | User JWT (Admin with `customers.update`) | Path: `id` | `{ id: string, status: "APPROVED", processedAt: string }` | 401, 403, 404 |
| PATCH | `/api/admin/data-deletion-requests/:id/reject` & `/api/v1/admin/data-deletion-requests/:id/reject` | `src/customers/admin-data-deletion-requests.controller.ts:52` | User JWT (Admin with `customers.update`) | Path: `id`. Body: `rejectionReason` (string max 500) | `{ id: string, status: "REJECTED", rejectionReason: string, processedAt: string }` | 400, 401, 403, 404 |
| GET | `/api/me/data-export` & `/api/v1/me/data-export` | `src/customers/me-deletion.controller.ts:16` | User JWT | None | `{ user: object, orders: Array<object>, wishlist: Array<object>, reviews: Array<object> }` | 401 |
| POST | `/api/me/request-deletion` & `/api/v1/me/request-deletion` | `src/customers/me-deletion.controller.ts:22` | User JWT | Body: `reason` (optional string max 500) | `{ message: string, requestId: string }` | 400, 401, 409 |
| GET | `/api/v1/admin/dashboard/stats` | `src/dashboard/admin-dashboard.controller.ts:20` | User JWT (Admin with `analytics.view`) | None | `{ totalRevenue: number, totalOrders: number, pendingOrders: number, totalCustomers: number, lowStockCount: number }` | 401, 403 |
| GET | `/api/admin/expenses` & `/api/v1/admin/expenses` | `src/expenses/expenses.controller.ts:38` | User JWT (Admin with `expenses.view`) | Query: `page` (int >= 1), `limit` (int 1..100), `category` (string), `startDate` (ISO string), `endDate` (ISO string) | `{ data: Array<{ id: string, title: string, amount: number, category: string, date: string, notes: string \| null }>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| POST | `/api/admin/expenses` & `/api/v1/admin/expenses` | `src/expenses/expenses.controller.ts:46` | User JWT (Admin with `expenses.manage`) | Body: `title` (string 2..120), `amount` (number > 0), `category` (string max 50), `date` (ISO date string), `notes` (optional string max 500) | Expense object | 400, 401, 403 |
| PATCH | `/api/admin/expenses/:id` & `/api/v1/admin/expenses/:id` | `src/expenses/expenses.controller.ts:55` | User JWT (Admin with `expenses.manage`) | Path: `id`. Body: optional expense fields | Expense object | 400, 401, 403, 404 |
| DELETE | `/api/admin/expenses/:id` & `/api/v1/admin/expenses/:id` | `src/expenses/expenses.controller.ts:64` | User JWT (Admin with `expenses.manage`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/admin/orders/export`, `/api/v1/admin/orders/export`, `/orders/export`, `/api/v1/orders/export` | `src/export/export.controller.ts:38` | User JWT (Admin with `orders.view`) | Query: `format` (`csv` or `excel`), `status`, `startDate`, `endDate` | Streamed file download (`text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) | 400, 401, 403 |
| GET | `/api/admin/customers/export`, `/api/v1/admin/customers/export`, `/customers/export`, `/api/v1/customers/export` | `src/export/export.controller.ts:68` | User JWT (Admin with `customers.view`) | Query: `format` (`csv` or `excel`), `tier` | Streamed file download | 400, 401, 403 |
| GET | `/api/admin/payments/export`, `/api/v1/admin/payments/export`, `/payments/export`, `/api/v1/payments/export` | `src/export/export.controller.ts:98` | User JWT (Admin with `finance.view`) | Query: `format` (`csv` or `excel`), `status`, `startDate`, `endDate` | Streamed file download | 400, 401, 403 |
| GET | `/health` & `/api/v1/health` | `src/health/health.controller.ts:46` | Public | None | `{ status: "ok" \| "degraded" \| "error", timestamp: string, database: { status: string, message: string }, cloudinary: { status: string, message: string }, paymob: { status: string, message: string } }` | None |
| GET | `/api/v1/health/detailed` | `src/health/health.controller.ts:53` | Public | None | Detailed health status object | None |
| GET | `/api/v1/health/backup` | `src/health/health.controller.ts:60` | User JWT (Admin with `settings.manage`) | None | `{ lastBackupTime: string \| null, isConfigured: boolean }` | 401, 403 |
| GET | `/api/admin/integrations/google-sheets/status` & `/api/v1/admin/integrations/google-sheets/status` | `src/integrations/admin-integrations.controller.ts:27` | User JWT (Admin with `settings.manage`) | None | `{ configured: boolean, sheetId: string \| null }` | 401, 403 |
| POST | `/api/admin/integrations/google-sheets/test` & `/api/v1/admin/integrations/google-sheets/test` | `src/integrations/admin-integrations.controller.ts:35` | User JWT (Admin with `settings.manage`) | Body: `spreadsheetId` (string) | `{ success: boolean, title: string }` | 400, 401, 403 |
| POST | `/api/admin/integrations/google-sheets/sync/products` & `/api/v1/admin/integrations/google-sheets/sync/products` | `src/integrations/admin-integrations.controller.ts:44` | User JWT (Admin with `products.view`) | None | `{ success: boolean, syncedCount: number }` | 401, 403 |
| POST | `/api/admin/integrations/google-sheets/sync/orders` & `/api/v1/admin/integrations/google-sheets/sync/orders` | `src/integrations/admin-integrations.controller.ts:53` | User JWT (Admin with `orders.view`) | None | `{ success: boolean, syncedCount: number }` | 401, 403 |
| POST | `/api/admin/integrations/google-sheets/sync/inventory` & `/api/v1/admin/integrations/google-sheets/sync/inventory` | `src/integrations/admin-integrations.controller.ts:62` | User JWT (Admin with `products.view`) | None | `{ success: boolean, syncedCount: number }` | 401, 403 |
| POST | `/api/admin/integrations/google-sheets/export/sales-report` & `/api/v1/admin/integrations/google-sheets/export/sales-report` | `src/integrations/admin-integrations.controller.ts:71` | User JWT (Admin with `orders.view`) | None | `{ success: boolean, reportUrl: string }` | 401, 403 |
| GET | `/api/v1/admin/meta/conversations` | `src/integrations/admin-meta.controller.ts:27` | User JWT (Admin with `customers.view`) | Query: `limit` (int 1..50), `before` (string), `after` (string) | Meta conversations list | 401, 403 |
| GET | `/api/v1/admin/meta/conversations/:id/messages` | `src/integrations/admin-meta.controller.ts:38` | User JWT (Admin with `customers.view`) | Path: `id` | Meta messages list | 401, 403 |
| POST | `/api/v1/admin/meta/conversations/:id/messages` | `src/integrations/admin-meta.controller.ts:52` | User JWT (Admin with `customers.update`) | Path: `id`. Body: `message` (string 1..2000) | Meta send response object | 400, 401, 403 |
| GET | `/api/v1/admin/excel/export/products` | `src/integrations/excel.controller.ts:44` | User JWT (Admin with `products.view`) | None | File download buffer | 401, 403 |
| GET | `/api/v1/admin/excel/export/orders` | `src/integrations/excel.controller.ts:60` | User JWT (Admin with `orders.view`) | None | File download buffer | 401, 403 |
| GET | `/api/v1/admin/excel/export/customers` | `src/integrations/excel.controller.ts:76` | User JWT (Admin with `customers.view`) | None | File download buffer | 401, 403 |
| POST | `/api/v1/admin/excel/import/products` | `src/integrations/excel.controller.ts:92` | User JWT (Admin with `products.edit`) | File upload (multipart form) | `{ importedCount: number, errors: string[] }` | 400, 401, 403 |
| POST | `/api/v1/admin/excel/import/inventory` | `src/integrations/excel.controller.ts:109` | User JWT (Admin with `products.edit`) | File upload (multipart form) | `{ updatedCount: number, errors: string[] }` | 400, 401, 403 |
| GET | `/api/v1/integrations/meta/webhook` | `src/integrations/meta.controller.ts:13` | Public (Meta hub verification) | Query: `hub.mode`, `hub.verify_token`, `hub.challenge` | Returns challenge string if verify token matches | 403 |
| POST | `/api/v1/integrations/meta/webhook` | `src/integrations/meta.controller.ts:26` | Public (HMAC via `MetaSignatureGuard`) | Headers: `X-Hub-Signature-256`. Body: Meta webhook payload | `{ status: "ok" }` | 401, 403 |
| POST | `/api/v1/admin/internal-notes` | `src/internal-notes/internal-notes.controller.ts:45` | User JWT (Admin with `orders.update_status`) | Body: `orderId` (string), `content` (string 1..2000) | `{ id: string, orderId: string, authorId: string, content: string, createdAt: string }` | 400, 401, 403 |
| GET | `/api/v1/admin/internal-notes` | `src/internal-notes/internal-notes.controller.ts:56` | User JWT (Admin with `orders.view`) | Query: `orderId` (string) | Array of internal note objects | 400, 401, 403 |
| GET | `/api/v1/admin/internal-notes/:id` | `src/internal-notes/internal-notes.controller.ts:69` | User JWT (Admin with `orders.view`) | Path: `id` | Internal note object | 401, 403, 404 |
| PATCH | `/api/v1/admin/internal-notes/:id` | `src/internal-notes/internal-notes.controller.ts:78` | User JWT (Admin with `orders.update_status`) | Path: `id`. Body: `content` (string 1..2000) | Internal note object | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/internal-notes/:id` | `src/internal-notes/internal-notes.controller.ts:91` | User JWT (Admin with `orders.update_status`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/message-templates`, `/api/v1/message-templates`, `/api/v1/admin/message-templates` | `src/message-templates/message-templates.controller.ts:30` | User JWT (Admin with `settings.manage`) | None | Array of message template objects | 401, 403 |
| PATCH | `/message-templates/:id`, `/api/v1/message-templates/:id`, `/api/v1/admin/message-templates/:id` | `src/message-templates/message-templates.controller.ts:38` | User JWT (Admin with `settings.manage`) | Path: `id`. Body: `subject` (optional string), `body` (optional string) | Message template object | 400, 401, 403, 404 |
| POST | `/api/admin/notifications/whatsapp/test` & `/api/v1/admin/notifications/whatsapp/test` | `src/notifications/admin-notifications.controller.ts:36` | User JWT (Admin with `settings.manage`) | Body: `phoneNumber` (string) | `{ success: boolean, message: string }` | 400, 401, 403 |
| POST | `/api/admin/notifications/test-alert` & `/api/v1/admin/notifications/test-alert` | `src/notifications/admin-notifications.controller.ts:45` | User JWT (Admin with `settings.manage`) | Body: `alertKey` (string), `message` (string) | `{ success: boolean }` | 400, 401, 403 |
| GET | `/api/admin/whatsapp/conversations` & `/api/v1/admin/whatsapp/conversations` | `src/notifications/admin-whatsapp.controller.ts:34` | User JWT (Admin with `customers.view`) | Query: `limit` (int 1..50) | List of WhatsApp conversations | 401, 403 |
| GET | `/api/admin/whatsapp/conversations/:conversationKey/messages` & `/api/v1/admin/whatsapp/conversations/:conversationKey/messages` | `src/notifications/admin-whatsapp.controller.ts:43` | User JWT (Admin with `customers.view`) | Path: `conversationKey` | List of WhatsApp messages | 401, 403 |
| POST | `/api/admin/whatsapp/conversations/:conversationKey/messages` & `/api/v1/admin/whatsapp/conversations/:conversationKey/messages` | `src/notifications/admin-whatsapp.controller.ts:56` | User JWT (Admin with `customers.update`) | Path: `conversationKey`. Body: `message` (string 1..2000) | Send message response object | 400, 401, 403 |
| GET | `/api/v1/integrations/whatsapp/webhook` | `src/notifications/whatsapp.controller.ts:13` | Public (Meta hub verification) | Query: `hub.mode`, `hub.verify_token`, `hub.challenge` | Returns challenge string | 403 |
| POST | `/api/v1/integrations/whatsapp/webhook` | `src/notifications/whatsapp.controller.ts:26` | Public (HMAC via `MetaSignatureGuard`) | Headers: `X-Hub-Signature-256`. Body: WhatsApp payload | `{ status: "ok" }` | 401, 403 |
| GET | `/api/admin/orders` & `/api/v1/admin/orders` | `src/orders/admin-orders.controller.ts:54` | User JWT (Admin with `orders.view`) | Query: `page` (int >= 1), `limit` (int 1..100), `status`, `paymentStatus`, `paymentMethod`, `search` | `{ data: Array<OrderObject>, meta: { page: number, limit: number, total: number, totalPages: number } }` | 400, 401, 403 |
| GET | `/api/admin/orders/:id` & `/api/v1/admin/orders/:id` | `src/orders/admin-orders.controller.ts:79` | User JWT (Admin with `orders.view`) | Path: `id` | Detailed Order Object (including items, customer, timeline) | 401, 403, 404 |
| PATCH | `/api/admin/orders/:id/status` & `/api/v1/admin/orders/:id/status` | `src/orders/admin-orders.controller.ts:88` | User JWT (Admin with `orders.update_status`) | Path: `id`. Body: `status` (OrderStatus enum) | Order Object | 400, 401, 403, 404 |
| PATCH | `/api/admin/orders/:id/shipping` & `/api/v1/admin/orders/:id/shipping` | `src/orders/admin-orders.controller.ts:101` | User JWT (Admin with `orders.update_status`) | Path: `id`. Body: `trackingNumber` (optional string), `carrier` (optional string) | Order Object | 400, 401, 403, 404 |
| PATCH | `/api/admin/orders/:id/cod-collected` & `/api/v1/admin/orders/:id/cod-collected` | `src/orders/admin-orders.controller.ts:114` | User JWT (Admin with `orders.update_status`) | Path: `id` | Order Object | 400, 401, 403, 404 |
| POST | `/api/admin/orders/:id/refund` & `/api/v1/admin/orders/:id/refund` | `src/orders/admin-orders.controller.ts:130` | User JWT (Admin with `orders.refund`) | Path: `id`. Body: `reason` (string max 500), `amount` (optional number > 0) | Refund Result Object | 400, 401, 403, 404 |
| POST | `/api/v1/internal/expire-reservations` | `src/orders/internal-orders.controller.ts:42` | Public (Intended for internal cron) | None | `{ processedCount: number }` | None |
| POST | `/api/v1/internal/reconcile-paymob` | `src/orders/internal-orders.controller.ts:82` | Public (Intended for internal cron) | None | `{ reconciledCount: number, errors: string[] }` | None |
| POST | `/api/v1/orders/track` | `src/orders/orders.controller.ts:52` | Public (Throttled: 5/min per IP, 3/min per orderNumber) | Body: `orderNumber` (string 5..50), `phone` (string 1..30) | Redacted public Order object (`{ id: string, orderNumber: string, status: string, totalAmount: number, items: Array<object>, createdAt: string }`) | 400, 404 (timing-safe indistinguishable), 429 |
| POST | `/api/v1/orders` | `src/orders/orders.controller.ts:69` | Public / Optional User JWT | Body: `customerName` (string 2..120), `customerEmail` (email 3..254), `shippingAddress` (optional), `shippingCity` (optional string max 100), `shippingCountry` (optional), `shippingPhone` (string max 30), `shippingZipCode` (optional), `notes` (optional), `idempotencyKey` (optional), `couponCode` (optional), `paymentMethod` (enum `ONLINE` \| `COD`), `items` (array 1..50 of `{ productVariantId: string, quantity: int 1..50 }`) | `{ order: OrderObject, guestAccessToken: string \| null }` | 400, 404, 409 |
| GET | `/api/v1/orders/:orderNumber` | `src/orders/orders.controller.ts:85` | Public with `X-Order-Access-Token` OR User JWT | Path: `orderNumber`. Header: `X-Order-Access-Token` (optional guest token) | Detailed Order object | 401, 403, 404 |
| POST | `/api/v1/orders/:orderNumber/cancel` | `src/orders/orders.controller.ts:114` | Public with `X-Order-Access-Token` OR User JWT | Path: `orderNumber`. Header: `X-Order-Access-Token`. Body: `reason` (optional string max 500) | Cancelled Order object | 400, 401, 403, 404 |
| POST | `/api/v1/payments/create-checkout-session` | `src/payment/payment.controller.ts:50` | Public with `X-Order-Access-Token` OR User JWT | Header: `X-Order-Access-Token`. Body: `orderId` (string 10..128 chars matching `/^[A-Za-z0-9_-]+$/`) | `{ checkoutUrl: string, paymentKey: string, iframeUrl: string }` | 400, 401, 403, 404 |
| POST | `/api/v1/payments/paymob-webhook` & `/api/v1/payments/webhook` | `src/payment/payment.controller.ts:89 & 106` | Public (Paymob HMAC signature in query/body) | Paymob webhook payload | `{ success: boolean }` | 400, 401 |
| POST | `/api/v1/payments/stripe-webhook` | `src/payment/payment.controller.ts:120` | Public | None | Always throws `BadRequestException("Stripe integration is disabled")` | 400 |
| POST | `/api/v1/payments/refund` | `src/payment/payment.controller.ts:137` | User JWT (Admin with `orders.refund`) | Body: `orderId` (string), `reason` (string) | `{ success: boolean, transactionId: string }` | 400, 401, 403, 404 |
| POST | `/api/v1/payments/reconcile` | `src/payment/payment.controller.ts:151` | User JWT (Admin with `orders.refund`) | None | `{ reconciledCount: number, errors: string[] }` | 401, 403 |
| PATCH | `/api/v1/admin/products/reorder` | `src/products/admin-products.controller.ts:48` | User JWT (Admin with `products.edit`) | Body: `productIds` (array of strings) | `{ success: boolean }` | 400, 401, 403 |
| GET | `/api/v1/admin/products` | `src/products/admin-products.controller.ts:59` | User JWT (Admin with `products.view`) | Query: `page`, `limit`, `search`, `status` | `{ data: Array<ProductObject>, meta: PaginationMeta }` | 400, 401, 403 |
| GET | `/api/v1/admin/products/:id` | `src/products/admin-products.controller.ts:81` | User JWT (Admin with `products.view`) | Path: `id` | Product Object (including variants, images, categories) | 401, 403, 404 |
| POST | `/api/v1/admin/products/:productId/variants` | `src/products/admin-products.controller.ts:90` | User JWT (Admin with `products.edit`) | Path: `productId`. Body: `sku` (string), `size` (optional), `color` (optional), `price` (number > 0), `stock` (int >= 0) | Variant Object | 400, 401, 403, 404 |
| PATCH | `/api/v1/admin/products/:productId/variants/:variantId` | `src/products/admin-products.controller.ts:107` | User JWT (Admin with `products.edit`) | Path: `productId`, `variantId`. Body: optional variant fields | Variant Object | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/products/:productId/variants/:variantId` | `src/products/admin-products.controller.ts:133` | User JWT (Admin with `products.edit`) | Path: `productId`, `variantId` | `{ success: boolean }` | 401, 403, 404 |
| POST | `/api/v1/admin/products/:productId/images` | `src/products/admin-products.controller.ts:157` | User JWT (Admin with `products.edit`) | Path: `productId`. Body: `url` (url string), `altText` (optional), `isPrimary` (optional boolean), `sortOrder` (optional int) | Image Object | 400, 401, 403, 404 |
| PATCH | `/api/v1/admin/products/:productId/images/:imageId` | `src/products/admin-products.controller.ts:170` | User JWT (Admin with `products.edit`) | Path: `productId`, `imageId`. Body: optional image fields | Image Object | 400, 401, 403, 404 |
| DELETE | `/api/v1/admin/products/:productId/images/:imageId` | `src/products/admin-products.controller.ts:189` | User JWT (Admin with `products.edit`) | Path: `productId`, `imageId` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/admin/products/:productId/price-history` | `src/products/admin-products.controller.ts:203` | User JWT (Admin with `products.view`) | Path: `productId` | Array of PriceHistory objects (`{ id, oldPrice, newPrice, changedAt, changedBy }`) | 401, 403, 404 |
| GET | `/api/v1/products` | `src/products/products.controller.ts:39` | Public | Query: `page` (int >= 1), `limit` (int 1..100), `category` (string max 160), `collection` (string max 160), `minPrice` (number string), `maxPrice` (number string), `hasDiscount` (boolean string), `isFeatured` (boolean string), `search` (string max 200) | `{ data: Array<ProductObject>, meta: PaginationMeta }` | 400 |
| GET | `/api/v1/products/:slug` | `src/products/products.controller.ts:91` | Public | Path: `slug` | Detailed Product object (including active variants and images) | 404 |
| PATCH | `/api/v1/products/reorder` | `src/products/products.controller.ts:100` | User JWT (Admin with `products.edit`) | Body: `productIds` (array of strings) | `{ success: boolean }` | 400, 401, 403 |
| POST | `/api/v1/products` | `src/products/products.controller.ts:114` | User JWT (Admin with `products.edit`) | Body: `name` (string 2..120), `slug` (optional string 2..120), `description` (string max 2000), `basePrice` (number > 0), `salePrice` (optional number), `status` (enum `DRAFT` \| `ACTIVE` \| `ARCHIVED`), `categoryId` (optional string), `collectionId` (optional string), `isFeatured` (optional boolean), `sortOrder` (optional int), `variants` (array of variant objects), `images` (array of image objects) | Product Object | 400, 401, 403, 409 |
| PATCH | `/api/v1/products/:id` | `src/products/products.controller.ts:136` | User JWT (Admin with `products.edit`) | Path: `id`. Body: optional product fields | Product Object | 400, 401, 403, 404 |
| DELETE | `/api/v1/products/:id` | `src/products/products.controller.ts:156` | User JWT (Admin with `products.edit`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/api/v1/referrals/my-code` | `src/referrals/referrals.controller.ts:23` | User JWT | None | `{ code: string, rewardPoints: number }` | 401 |
| POST | `/api/v1/referrals/validate` | `src/referrals/referrals.controller.ts:31` | Public / Optional User JWT | Body: `code` (string) | `{ valid: boolean, discountPercentage: number }` | 400 |
| GET | `/api/v1/admin/reviews` | `src/reviews/admin-reviews.controller.ts:36` | User JWT (Admin with `products.view`) | None | Array of review objects | 401, 403 |
| PATCH | `/api/v1/admin/reviews/:id/approve` | `src/reviews/admin-reviews.controller.ts:47` | User JWT (Admin with `products.edit`) | Path: `id` | Review object | 401, 403, 404 |
| DELETE | `/api/v1/admin/reviews/:id` | `src/reviews/admin-reviews.controller.ts:58` | User JWT (Admin with `products.edit`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| POST | `/api/v1/products/:productId/reviews` | `src/reviews/reviews.controller.ts:25` | Public / Optional User JWT | Path: `productId`. Body: `rating` (int 1..5), `comment` (string 1..1000), `authorName` (string 1..100) | Review Object | 400, 404 |
| GET | `/api/v1/products/:productId/reviews` | `src/reviews/reviews.controller.ts:42` | Public | Path: `productId` | Array of approved review objects | 404 |
| GET | `/api/admin/maintenance-mode` & `/api/v1/admin/maintenance-mode` | `src/settings/admin-settings.controller.ts:30` | User JWT (Admin with `settings.manage`) | None | `{ enabled: boolean, message: string \| null }` | 401, 403 |
| PUT | `/api/admin/maintenance-mode` & `/api/v1/admin/maintenance-mode` | `src/settings/admin-settings.controller.ts:37` | User JWT (Admin with `settings.manage`) | Body: `enabled` (boolean), `message` (optional string max 500) | `{ enabled: boolean, message: string \| null }` | 400, 401, 403 |
| GET | `/api/admin/settings/enforce-2fa` & `/api/v1/admin/settings/enforce-2fa` | `src/settings/admin-settings.controller.ts:44` | User JWT (Admin with `settings.manage`) | None | `{ enabled: boolean }` | 401, 403 |
| PUT | `/api/admin/settings/enforce-2fa` & `/api/v1/admin/settings/enforce-2fa` | `src/settings/admin-settings.controller.ts:51` | User JWT (Admin with `settings.manage`) | Body: `enabled` (boolean) | `{ enabled: boolean }` | 400, 401, 403 |
| GET | `/api/admin/settings/alerts` & `/api/v1/admin/settings/alerts` | `src/settings/admin-settings.controller.ts:58` | User JWT (Admin with `settings.manage`) | None | `{ alertEmail: string \| null }` | 401, 403 |
| PUT | `/api/admin/settings/alerts` & `/api/v1/admin/settings/alerts` | `src/settings/admin-settings.controller.ts:65` | User JWT (Admin with `settings.manage`) | Body: `alertEmail` (email string) | `{ alertEmail: string }` | 400, 401, 403 |
| GET | `/api/v1/settings/site/public` | `src/settings/site-settings.controller.ts:23` | Public | None | `{ storeName, contactEmail, contactPhone, currency, maintenanceMode, minOrderAmount, freeShippingThreshold, codEnabled, codFee, codMaxAmount, cookieConsentText, businessHours, socialLinks }` | None |
| GET | `/api/v1/settings/site` | `src/settings/site-settings.controller.ts:31` | User JWT (Admin with `settings.manage`) | None | Full SiteSettings singleton object | 401, 403 |
| PATCH | `/api/v1/settings/site` | `src/settings/site-settings.controller.ts:42` | User JWT (Admin with `settings.manage`) | Body: optional site setting fields | Full updated SiteSettings singleton object | 400, 401, 403 |
| GET | `/shipping-zones` & `/api/v1/shipping-zones` | `src/shipping-zones/shipping-zones.controller.ts:36` | Public | None | Array of active shipping zone objects (`{ id, zoneName, cityLabel, fee, estimatedDeliveryDays, isActive }`) | None |
| GET | `/shipping-zones/admin` & `/api/v1/shipping-zones/admin` | `src/shipping-zones/shipping-zones.controller.ts:50` | User JWT (Admin with `lists.manage`) | None | Array of all shipping zones (including inactive) | 401, 403 |
| POST | `/shipping-zones` & `/api/v1/shipping-zones` | `src/shipping-zones/shipping-zones.controller.ts:69` | User JWT (Admin with `lists.manage`) | Body: `zoneName` (string 2..100), `cityLabel` (string 2..100), `fee` (number >= 0), `estimatedDeliveryDays` (optional string max 50), `isActive` (optional boolean) | Shipping Zone Object | 400, 401, 403 |
| PATCH | `/shipping-zones/:id` & `/api/v1/shipping-zones/:id` | `src/shipping-zones/shipping-zones.controller.ts:93` | User JWT (Admin with `lists.manage`) | Path: `id`. Body: optional shipping zone fields | Shipping Zone Object | 400, 401, 403, 404 |
| PATCH | `/shipping-zones/:id/deactivate` & `/api/v1/shipping-zones/:id/deactivate` | `src/shipping-zones/shipping-zones.controller.ts:118` | User JWT (Admin with `lists.manage`) | Path: `id` | Shipping Zone Object | 401, 403, 404 |
| GET | `/static-pages/:slug` & `/api/v1/static-pages/:slug` | `src/static-pages/static-pages.controller.ts:32` | Public | Path: `slug` | `{ id: string, title: string, slug: string, content: string, type: string, images: string[], updatedAt: string }` | 404 |
| GET | `/static-pages` & `/api/v1/static-pages` | `src/static-pages/static-pages.controller.ts:41` | User JWT (Admin with `settings.manage`) | None | Array of static page objects | 401, 403 |
| PATCH | `/static-pages/:id` & `/api/v1/static-pages/:id` | `src/static-pages/static-pages.controller.ts:54` | User JWT (Admin with `settings.manage`) | Path: `id`. Body: `title` (optional), `content` (optional), `images` (optional array) | Static Page Object | 400, 401, 403, 404 |
| POST | `/api/admin/suppliers` & `/api/v1/admin/suppliers` | `src/suppliers/suppliers.controller.ts:39` | User JWT (Admin with `settings.manage`) | Body: `name` (string 2..120), `contactName` (optional), `email` (optional email), `phone` (optional), `address` (optional) | Supplier Object | 400, 401, 403 |
| GET | `/api/admin/suppliers` & `/api/v1/admin/suppliers` | `src/suppliers/suppliers.controller.ts:46` | User JWT (Admin with `settings.manage`) | Query: `page`, `limit`, `search` | `{ data: Array<SupplierObject>, meta: PaginationMeta }` | 400, 401, 403 |
| GET | `/api/admin/suppliers/:id` & `/api/v1/admin/suppliers/:id` | `src/suppliers/suppliers.controller.ts:53` | User JWT (Admin with `settings.manage`) | Path: `id` | Supplier Object | 401, 403, 404 |
| PATCH | `/api/admin/suppliers/:id` & `/api/v1/admin/suppliers/:id` | `src/suppliers/suppliers.controller.ts:61` | User JWT (Admin with `settings.manage`) | Path: `id`. Body: optional supplier fields | Supplier Object | 400, 401, 403, 404 |
| DELETE | `/api/admin/suppliers/:id` & `/api/v1/admin/suppliers/:id` | `src/suppliers/suppliers.controller.ts:73` | User JWT (Admin with `settings.manage`) | Path: `id` | `{ success: boolean }` | 401, 403, 404 |
| GET | `/system-lists/types` & `/api/v1/system-lists/types` | `src/system-lists/system-lists.controller.ts:38` | User JWT (Admin with `lists.manage`) | None | Array of SystemListType objects | 401, 403 |
| GET | `/system-lists/:listTypeKey/items` & `/api/v1/system-lists/:listTypeKey/items` | `src/system-lists/system-lists.controller.ts:54` | Public | Path: `listTypeKey`. Query: `page`, `limit`, `search` | Array of active ListItem objects (returns bare array) | 400 |
| POST | `/system-lists/:listTypeKey/items` & `/api/v1/system-lists/:listTypeKey/items` | `src/system-lists/system-lists.controller.ts:75` | User JWT (Admin with `lists.manage`) | Path: `listTypeKey`. Body: `label` (string 1..100), `value` (string 1..100), `sortOrder` (optional int) | ListItem Object | 400, 401, 403 |
| PATCH | `/system-lists/items/:id` & `/api/v1/system-lists/items/:id` | `src/system-lists/system-lists.controller.ts:102` | User JWT (Admin with `lists.manage`) | Path: `id`. Body: optional listItem fields | ListItem Object | 400, 401, 403, 404 |
| PATCH | `/system-lists/items/:id/deactivate` & `/api/v1/system-lists/items/:id/deactivate` | `src/system-lists/system-lists.controller.ts:124` | User JWT (Admin with `lists.manage`) | Path: `id` | ListItem Object | 401, 403, 404 |
| POST | `/api/v1/upload/image` | `src/upload/upload.controller.ts:30` | User JWT (Admin with `products.edit`) | File upload (multipart/form-data, field `file`) | `{ url: string, publicId: string }` | 400, 401, 403 |
| GET | `/api/v1/wishlist` | `src/wishlist/wishlist.controller.ts:26` | User JWT | None | Array of wishlist item objects (`{ id, productId, product: ProductObject }`) | 401 |
| POST | `/api/v1/wishlist` | `src/wishlist/wishlist.controller.ts:32` | User JWT | Body: `productId` (non-empty string) | Wishlist Item Object | 400, 401, 404 |
| DELETE | `/api/v1/wishlist/:productId` | `src/wishlist/wishlist.controller.ts:43` | User JWT | Path: `productId` | `{ success: boolean }` | 401, 404 |

---

## 2. Storefront Contract Check

Comparison of requested endpoints against storefront contract requirements:

1. **`GET /products` (query: `page`, `limit<=100`, `category`, `collection`, `minPrice`, `maxPrice`, `hasDiscount`, `isFeatured`, `search`)**
   - **Status:** **EXISTS AND MATCHES** (`src/products/products.controller.ts:39`, `src/products/dto/list-products-query.dto.ts:11-66`).
   - All query parameters (`page`, `limit` with `@Max(100)`, `category`, `collection`, `minPrice`, `maxPrice`, `hasDiscount`, `isFeatured`, `search`) are supported and validated.
2. **`GET /products/:slug`**
   - **Status:** **EXISTS AND MATCHES** (`src/products/products.controller.ts:91`).
   - Retrieves product by slug with relations (`variants`, `images`, `category`, `collection`).
3. **`GET /categories`**
   - **Status:** **EXISTS BUT DIFFERENT** (`src/categories/categories.controller.ts:40`).
   - The route path is `/api/v1/categories` (or root prefix depending on proxy), accepts `ListCategoriesQueryDto` (`page`, `limit`, `search`), but **returns a bare array** (`Category[]`) instead of a paginated wrapper (`{ data, meta }`).
4. **`GET /collections`**
   - **Status:** **EXISTS BUT DIFFERENT** (`src/collections/collections.controller.ts:14`).
   - Accepts `ListCollectionsQueryDto` (`page`, `limit`, `search`), but **returns a bare array** (`Collection[]`) instead of a paginated wrapper (`{ data, meta }`).
5. **`GET /collections/:slug`**
   - **Status:** **EXISTS AND MATCHES** (`src/collections/collections.controller.ts:22`).
6. **`GET /banners`**
   - **Status:** **EXISTS AND MATCHES** (`src/banners/banners.controller.ts:43`).
   - Returns active banners mapped to public shape.
7. **`GET /settings/site/public`**
   - **Status:** **EXISTS AND MATCHES** (`src/settings/site-settings.controller.ts:23`).
   - Returns public store configuration (`storeName`, `currency`, `minOrderAmount`, `freeShippingThreshold`, `codEnabled`, `codFee`, `codMaxAmount`, etc.).
8. **`GET /shipping-zones`**
   - **Status:** **EXISTS AND MATCHES** (`src/shipping-zones/shipping-zones.controller.ts:36`).
   - Accessible via `/shipping-zones` or `/api/v1/shipping-zones`.
9. **`POST /coupons/validate` (body: `code`, `subtotal` in EGP)**
   - **Status:** **EXISTS AND MATCHES** (`src/coupons/coupons.controller.ts:12`, `src/coupons/dto/validate-coupon.dto.ts:5-15`).
   - Takes `code` and `subtotal` (in EGP) and returns `{ valid, code, discountType, discountAmount, calculatedDiscount, finalSubtotal }`.
10. **`POST /orders`**
    - **Status:** **EXISTS AND MATCHES** (`src/orders/orders.controller.ts:69`, `src/orders/dto/create-order.dto.ts:34-110`).
    - Accepts items, customer details, optional coupon and payment method. Returns order object and signed `guestAccessToken` if order is placed by guest.
11. **`POST /payments/create-checkout-session` (header `X-Order-Access-Token`)**
    - **Status:** **EXISTS AND MATCHES** (`src/payment/payment.controller.ts:50`).
    - Validates access via JWT or `X-Order-Access-Token` header using `verifyOrderOwnership` (`src/common/utils/order-ownership.ts:15`).
12. **`GET /orders/:orderNumber` and `POST /orders/:orderNumber/cancel` (header `X-Order-Access-Token`)**
    - **Status:** **EXISTS AND MATCHES** (`src/orders/orders.controller.ts:85` & `114`).
    - Both endpoints check JWT ownership or verify the guest token supplied in the `X-Order-Access-Token` header.

---

## 3. Response-Shape Inconsistencies, Pagination Gaps, & Naming Inconsistencies

1. **Pagination Structure Discrepancy:**
   - Standard paginated endpoints (e.g. `GET /api/v1/products` at `src/products/products.controller.ts:39`, `GET /api/v1/admin/orders` at `src/orders/admin-orders.controller.ts:54`, `GET /api/v1/admin/customers` at `src/customers/admin-customers.controller.ts:41`) return `{ data: [...], meta: { page, limit, total, totalPages } }`.
   - In contrast, public endpoints taking pagination parameters `page` and `limit` such as `GET /api/v1/categories` (`src/categories/categories.controller.ts:40`), `GET /api/v1/collections` (`src/collections/collections.controller.ts:14`), and `GET /system-lists/:listTypeKey/items` (`src/system-lists/system-lists.controller.ts:54`) ignore `meta` wrapping and return bare arrays (`Array<Item>`).
2. **Naming Inconsistencies across Models:**
   - Image primary indicator is named `isPrimary` on `ProductImage` (`src/products/admin-products.controller.ts:157`), but `isActive` / `sortOrder` on `Banner` (`src/banners/banners.controller.ts:43`).
   - Customer identifier in order DTO is `customerEmail` (`src/orders/dto/create-order.dto.ts:42`), whereas user profile uses `email` (`src/auth/dto/create-user.dto.ts:7`).
3. **Money Representation Uniformity:**
   - All amounts (subtotal, shippingFee, codFee, discountAmount, totalAmount) returned in public and admin JSON responses are represented in EGP standard floats (`number`). Convertions to integer piasters are restricted internally to Paymob API payload construction (`src/payment/paymob.service.ts:110`).

---

## 4. Order and Payment Flow Step by Step

1. **Order Creation & Price Computation (`src/orders/orders.service.ts:80-220`):**
   - **Variant & Stock Check:** Reads each variant by `productVariantId`. Verifies `product.status === "ACTIVE"` and `variant.stock >= item.quantity`.
   - **Subtotal Calculation:** `itemPrice = salePrice ?? basePrice`. Item subtotal = `itemPrice * quantity`. Total subtotal = sum of item subtotals.
   - **Coupon Validation (`src/coupons/coupons.service.ts:25`):** If `couponCode` provided, verifies coupon exists, `isActive === true`, not expired (`expiresAt`), under usage limit (`usageLimit`), and `subtotal >= minOrderAmount`. Calculates discount (`PERCENTAGE` capped at `maxDiscountAmount` or `FIXED_AMOUNT`).
   - **Shipping Calculation (`src/orders/orders.service.ts:135`):** Matches `shippingCity` against active `ShippingZone` records (`cityLabel` case-insensitive trimmed compare). If `siteSettings.freeShippingThreshold` is configured and `(subtotal - discount) >= freeShippingThreshold`, `shippingFee = 0`; otherwise `shippingFee = shippingZone.fee`.
   - **COD Fee Rules (`src/orders/orders.service.ts:160`):** If `paymentMethod === COD`:
     - Checks `siteSettings.codEnabled === true` (otherwise throws 400).
     - Checks `(subtotal - discount + shippingFee) <= siteSettings.codMaxAmount` (otherwise throws 400).
     - Adds `codFee = siteSettings.codFee` to `totalAmount`.
   - **Total Amount Computation:** `totalAmount = (subtotal - discount) + shippingFee + (isCod ? codFee : 0)`.
   - **Stock Decrement & Reservation:**
     - For `ONLINE` payments: Decrements `variant.stock` and creates `Order` with `status = PENDING`, `paymentStatus = UNPAID`, and `reservationExpiresAt = now + 15 minutes` (`src/orders/orders.service.ts:185`).
     - For `COD` payments: Decrements `variant.stock`, creates `Order` with `status = PROCESSING`, `paymentStatus = UNPAID`, and `reservationExpiresAt = null` (`src/orders/orders.service.ts:192`).
   - **Idempotency:** If `idempotencyKey` provided, stored on `Order.idempotencyKey` (unique constraint). Duplicate submission returns existing order (`src/orders/orders.service.ts:92`).
   - **Guest Access Token Generation:** For unauthenticated orders, generates a JWT containing `{ orderId, orderNumber, type: "GUEST_ORDER" }` signed with `JWT_SECRET`, valid for 30 days (`src/orders/orders.service.ts:210`).

2. **Guest Token Verification (`src/common/utils/order-ownership.ts:15`):**
   - Endpoints requiring access to guest orders (`GET /orders/:orderNumber`, `POST /orders/:orderNumber/cancel`, `POST /payments/create-checkout-session`) inspect `req.user` (if authenticated via JWT) or decode `X-Order-Access-Token` header.
   - Decodes token, verifies `type === "GUEST_ORDER"` and `orderId === order.id` or `orderNumber === order.orderNumber`.

3. **Paymob Checkout Session & Payment Execution (`src/payment/paymob.service.ts:80-160`):**
   - Endpoint `POST /api/v1/payments/create-checkout-session` checks order status is `PENDING` and unpaid.
   - Authenticates with Paymob API (`POST /api/v1/intention/`), converting `totalAmount` in EGP to integer piasters (`totalAmount * 100`).
   - Returns Paymob checkout URL and payment key.

4. **Paymob Webhook Lifecycle (`src/payment/payment.controller.ts:89`, `src/payment/paymob.service.ts:180-250`):**
   - **Route:** `POST /api/v1/payments/paymob-webhook` (and legacy `/api/v1/payments/webhook`).
   - **Signature Verification:** Calculates HMAC-SHA256 over concatenated query string / body parameters using `PAYMOB_HMAC_SECRET` (`src/payment/paymob.service.ts:200`). Compares calculated HMAC with `hmac` param using `timingSafeCompare` (`src/common/utils/timing-safe-compare.ts:5`).
   - **Success Handler (`obj.success === true` or `success === "true"`):**
     - Sets order `paymentStatus = PAID`, `status = PROCESSING`, `reservationExpiresAt = null`.
     - Increments coupon `usageCount` if coupon was applied.
     - Sends order confirmation email via `EmailService`.
   - **Failure Handler (`obj.success === false`):**
     - Sets order `paymentStatus = FAILED`.
     - Restores stock for all variants in order items (`variant.stock += item.quantity`).

5. **Order Cancellation Rules (`src/orders/orders.service.ts:280`):**
   - Allowed only if `order.status` is `PENDING` or `PROCESSING` and `order.paymentStatus !== "PAID"`.
   - Restores stock for all order items.
   - Updates `order.status = CANCELLED`.

---

## 5. Environment & Configuration

### Env Var Inventory
Listed by variable name, usage context, required/optional status, and default value:

| Variable Name | Required / Optional | Default Value | Description / Usage |
|---|---|---|---|
| `NODE_ENV` | Required | `development` | Environment mode (`development`, `production`, `test`). Validated in `src/config/environment.validation.ts:15`. |
| `DATABASE_URL` | Required | None | PostgreSQL connection string used by Prisma (`prisma/schema.prisma:9`). |
| `JWT_SECRET` | Required (outside dev/test) | Fallback in local dev | Secret key for signing JWTs and guest access tokens (`src/auth/jwt-secret.util.ts:10`). |
| `FRONTEND_URL` | Optional | `http://localhost:3000` | Front-end origin URL for CORS policy (`src/app.config.ts:52`). |
| `ADMIN_FRONTEND_URL` | Optional | `http://localhost:3001` | Admin dashboard origin URL for CORS policy (`src/app.config.ts:53`). |
| `TRUST_PROXY_HOPS` | Optional | `1` | Reverse proxy hop count for IP identification (`src/main.ts:36`). |
| `SENTRY_DSN` | Optional | None | Sentry error tracking DSN (`src/main.ts:21`). |
| `EMAIL_PROVIDER_API_KEY` | Optional | None | Resend API key for sending transactional emails (`src/email/email.service.ts:18`). |
| `EMAIL_FROM_ADDRESS` | Optional | `noreply@rive.com` | From address for transactional emails (`src/email/email.service.ts:19`). |
| `EMAIL_PROVIDER_API_URL` | Optional | `https://api.resend.com/emails` | Resend HTTP API endpoint (`src/email/email.service.ts:20`). |
| `ADMIN_ALERT_EMAIL` | Optional | None | Recipient email for critical system alert notifications (`src/notifications/notifications.service.ts:25`). |
| `CLOUDINARY_CLOUD_NAME` | Optional | None | Cloudinary cloud name for image uploads (`src/upload/upload.service.ts:15`). |
| `CLOUDINARY_API_KEY` | Optional | None | Cloudinary API key (`src/upload/upload.service.ts:16`). |
| `CLOUDINARY_API_SECRET` | Optional | None | Cloudinary API secret (`src/upload/upload.service.ts:17`). |
| `PAYMOB_API_KEY` | Optional | None | Paymob API Key (`src/payment/paymob.service.ts:22`). |
| `PAYMOB_INTEGRATION_ID` | Optional | None | Paymob Integration ID (`src/payment/paymob.service.ts:23`). |
| `PAYMOB_IFRAME_ID` | Optional | None | Paymob iFrame ID (`src/payment/paymob.service.ts:24`). |
| `PAYMOB_HMAC_SECRET` | Optional | None | Paymob HMAC secret key for webhook signature verification (`src/payment/paymob.service.ts:25`). |
| `META_APP_SECRET` | Optional | None | Meta/WhatsApp App Secret for webhook HMAC verification (`src/common/guards/meta-signature.guard.ts:18`). |
| `META_PAGE_ACCESS_TOKEN` | Optional | None | Meta Page Access Token for Facebook/Instagram messaging (`src/integrations/meta.service.ts:15`). |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | None | WhatsApp Business Phone Number ID (`src/notifications/whatsapp.service.ts:15`). |
| `WHATSAPP_ACCESS_TOKEN` | Optional | None | WhatsApp Business API Access Token (`src/notifications/whatsapp.service.ts:16`). |

### CORS Configuration Mechanics
CORS origins are dynamically generated in `src/app.config.ts:51-64` as follows:
- `configuredOrigins`: Parsed list of URLs from comma-delimited `FRONTEND_URL` and `ADMIN_FRONTEND_URL` via `parseOrigins()` (`src/common/utils/origin.ts:5`).
- `developmentOrigins`: Hardcoded array `["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]`.
- When `isLocalOnlyEnvironment()` is `true` (`NODE_ENV` is not `production` or `staging`), `allowedOrigins` combines `configuredOrigins` and `developmentOrigins`. In production, only `configuredOrigins` are allowed.

### Paymob Mode Determination
- Paymob live vs. test environment is **determined entirely by the credentials/keys provided in configuration** (`PAYMOB_API_KEY` and `PAYMOB_INTEGRATION_ID`). Paymob's unified API base URL (`https://accept.paymob.com/api`) handles sandbox vs. live routing based on the account keys.

---

## 6. Missing or Weak Points

1. **Missing Essential Storefront Endpoints:**
   - **Cart / Checkout Pre-flight:** No dedicated endpoint to validate cart stock availability before initiating checkout.
   - **Password Reset Request Response:** `POST /api/v1/auth/forgot-password` returns a generic success message even if the email does not exist, but no endpoint exists to verify password reset token validity prior to form submission.
2. **Unprotected Cron/Internal Endpoints:**
   - `POST /api/v1/internal/expire-reservations` (`src/orders/internal-orders.controller.ts:42`) and `POST /api/v1/internal/reconcile-paymob` (`src/orders/internal-orders.controller.ts:82`) have **no authentication guards or secret headers**. Anyone can invoke these endpoints to trigger stock release or reconciliation loops.
3. **Exposed Public Data:**
   - `GET /api/v1/settings/site/public` (`src/settings/site-settings.controller.ts:23`) returns overall site settings. Care should be taken to ensure admin metadata is not attached.
4. **Rate Limiting Gaps:**
   - While `POST /api/v1/orders/track` implements custom rate limiting (`src/common/utils/throttling.ts`), standard public endpoints such as `POST /api/v1/orders`, `POST /api/v1/auth/login`, and `POST /api/v1/coupons/validate` rely solely on global NestJS throttler configs which may be permissive if `TRUST_PROXY_HOPS` is misconfigured.
5. **DTO Validation Weaknesses:**
   - `POST /api/v1/orders` (`src/orders/dto/create-order.dto.ts:34`) accepts optional `shippingCity` without enforcing enum values against existing `ShippingZone` records at the DTO layer, causing validation to fail deeper in service logic with generic 400 exceptions.
6. **Committed Secrets / Environment Files Check:**
   - No secret values or `.env` files with credentials are committed in the repository tree. `.env.example` contains only template names and placeholder strings.
7. **Placeholder Seed Data:**
   - `prisma/seed-logic.ts` contains development default credentials (e.g. `admin@rive.com` / `AdminPass123!`). Production deployments must ensure `npm run reset-admin` or custom seed scripts override these defaults immediately.
