# Architecture Overview — `rive-backend`

This document provides a high-level architectural overview of `rive-backend`, explaining data flow, component interactions, external service integrations, core business domain logic, and security mechanisms.

---

## 🏗️ 1. High-Level Data Flow

```
+------------------------+      +------------------------+
|  RIVÉ Storefront App   |      |  RIVÉ Admin Dashboard  |
|  (Customer Web Client) |      |  (Operations / Staff)  |
+-----------+------------+      +-----------+------------+
            |                               |
            | HTTP / REST (JSON)            | HTTP / REST (JSON)
            +---------------+---------------+
                            |
                            v
+--------------------------------------------------------+
|                      rive-backend                      |
|                                                        |
|  +--------------------------------------------------+  |
|  | Middleware & Guards                              |  |
|  | - Request Logging & IP Resolution (Trust Proxy)  |  |
|  | - Helmet Security Headers                        |  |
|  | - CORS Protection & Origin Validation            |  |
|  | - Throttler Guard (Rate Limiting)                |  |
|  | - JWT Authentication & RBAC Guard                |  |
|  +------------------------+-------------------------+  |
|                           |                            |
|  +------------------------v-------------------------+  |
|  | Controllers                                      |  |
|  | (Auth, Products, Orders, Payment, Categories...)   |  |
|  +------------------------+-------------------------+  |
|                           |                            |
|  +------------------------v-------------------------+  |
|  | Domain Services                                  |  |
|  | (OrdersService, ProductsService, PaymentService) |  |
|  +------------------------+-------------------------+  |
|                           |                            |
|  +------------------------v-------------------------+  |
|  | Prisma ORM & PostgreSQL Database                 |  |
|  +--------------------------------------------------+  |
+---------------------------+----------------------------+
                            |
           +----------------+----------------+
           |                |                |
           v                v                v
    +--------------+ +--------------+ +--------------+
    | Stripe API   | | Cloudinary   | | Resend API   |
    | (Payments)   | | (Media)      | | (Email)      |
    +--------------+ +--------------+ +--------------+
```

---

## 🔌 2. External Service Integrations

### A. Stripe Payment Processing (`PaymentService`)
- **Checkout Sessions**: When a customer initiates payment, `PaymentService.createCheckoutSession` constructs a Stripe Checkout Session referencing the order ID.
- **Webhook Processing (`POST /api/v1/payments/webhook`)**: Stripe notifies the backend asynchronously when payment completes (`checkout.session.completed`).
- **Signature Verification**: Webhooks enforce strict cryptographic raw body signature verification using `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent`.
- **Idempotency & State Integrity**: Webhook handlers process payments within a database transaction. If an order is already marked `PAID`, duplicate webhook events return early without re-processing.

### B. Cloudinary Asset Storage (`UploadService`)
- **Image Uploads**: Handles image uploads for product variants and catalog banners.
- **Validation**: Incoming files are validated for MIME type (`image/jpeg`, `image/png`, `image/webp`) and file size limits before stream uploading to Cloudinary.

### C. Resend Transactional Email (`EmailService`)
- **Email Delivery**: Uses Resend's HTTP API (`EMAIL_PROVIDER_API_KEY`) to deliver transactional emails.
- **Use Cases**: Password reset tokens, email verification tokens, and administrative notification triggers.

---

## ⚙️ 3. Core Domain Concepts & Mechanisms

### A. Inventory Reservation System
To prevent overselling luxury items during high-demand drops:
1. **Creation**: When an order is created (`OrdersService.create`), stock for each product variant is atomically decremented (`stock = stock - quantity`) within a Prisma database transaction.
2. **30-Minute Window**: A `reservationExpiresAt` timestamp is set to `Date.now() + 30 minutes`.
3. **Expiration & Stock Restoration**:
   - If payment is completed within 30 minutes, the order transitions to `PAID` and `reservationExpiresAt` is cleared.
   - If unpaid after 30 minutes or explicitly cancelled, the order transitions to `EXPIRED` or `CANCELLED`, and variant stock is atomically incremented (`stock = stock + quantity`) back to the inventory pool within a transaction.
4. **Hybrid Cron Expiry**:
   - **Inline On-Module Init**: Expires overdue pending reservations on application startup.
   - **External Scheduled Cron**: Periodically invokes `POST /api/v1/internal/expire-reservations` (secured via `INTERNAL_CRON_SECRET`) to process expired reservations across active instances.

### B. Order Lifecycle & State Machine
Valid order status transitions are strictly enforced by `OrdersService.assertTransition`:

```
               +--------------+
               |   PENDING    |
               +------+-------+
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
  +-----------+ +-----------+ +-----------+
  |   PAID    | | CANCELLED | |  EXPIRED  |
  +-----+-----+ +-----------+ +-----------+
        |
        v
  +-----------+
  |  SHIPPED  |
  +-----+-----+
        |
        v
  +-----------+
  | DELIVERED |
  +-----------+
```

### C. Order Access Security & Ownership Isolation
- **Authenticated Orders**: Linked to `userId`. Can only be accessed by the user who created it or users with the `ADMIN` role.
- **Guest Orders**: Assigned a cryptographically secure 64-character hexadecimal `guestAccessToken`. Access to guest orders requires providing `X-Order-Access-Token` matching `guestAccessToken`.
- **Enumeration Prevention**: Requesting an unowned or non-existent order returns identical `404 Not Found` error messages to prevent order existence enumeration attacks.

---

## 🔒 4. Security & Hardening Model

1. **Authentication & Authorization**:
   - Passwords hashed using `bcrypt` (salt rounds = 10).
   - JWT tokens signed with `JWT_SECRET` (minimum 32 characters in production).
   - Role-Based Access Control (`@Roles('ADMIN')`) enforced by `RolesGuard`.
2. **Network Security & Rate Limiting**:
   - `Helmet` sets secure HTTP headers (Content Security Policy, HSTS, frameguard).
   - `ThrottlerGuard` protects sensitive endpoints (e.g., login, password reset, checkout) against brute-force attacks.
   - `TRUST_PROXY_HOPS` configures Express trust proxy settings so client IP address extraction is accurate behind Nginx/ALB/Cloudflare proxies.
