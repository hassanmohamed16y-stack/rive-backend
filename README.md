# RIVÉ Backend Service (`rive-backend`)

The RESTful API backend service for the **RIVÉ** luxury e-commerce platform. Built with [NestJS](https://nestjs.com/), [Prisma ORM](https://www.prisma.io/), and [PostgreSQL](https://www.postgresql.org/).

---

## 📌 Overview & Ecosystem Architecture

`rive-backend` serves as the centralized core API engine for the entire RIVÉ platform ecosystem:

- **Storefront Client (`rive-storefront`)**: Public customer-facing luxury e-commerce web application. Interacts with `rive-backend` for product browsing, cart handling, checkout session creation, customer authentication, and order status tracking.
- **Admin Dashboard (`rive-admin`)**: Internal administrative web interface used by operations, managers, and admins. Interacts with `rive-backend` for product management, category configuration, inventory management, order status transitions, refunds, and audit log inspection.
- **`rive-backend` (This repository)**: Encapsulates all domain business logic, data persistence, payment processing via Stripe, media file uploads via Cloudinary, transactional emails via Resend, inventory reservations, order lifecycle management, and role-based security.

---

## 🛠️ Tech Stack & Key Dependencies

| Component / Layer | Technology | Key Details & Version |
|---|---|---|
| **Framework** | NestJS | Node.js enterprise backend framework (`^11.2.3`) |
| **Language** | TypeScript | Strictly typed Javascript (`^5.5.4`) |
| **ORM / Database Access** | Prisma ORM | Type-safe query builder & migrations (`^5.18.0`) |
| **Database Engine** | PostgreSQL | Relational Database |
| **Authentication** | Passport.js & JWT | Bearer tokens & Role-Based Access Control (RBAC) |
| **API Documentation** | OpenAPI / Swagger | Integrated interactive docs (`@nestjs/swagger ^11.4.7`) |
| **Payment Gateway** | Stripe API | Checkout sessions & Webhooks (`^15.0.0`) |
| **Storage & Uploads** | Cloudinary API | Image upload and transformations (`^2.11.0`) |
| **Transactional Email** | Resend HTTP API | Password reset & order verification |
| **Testing** | Jest & Supertest | Unit, integration & e-commerce E2E testing (`^30.0.0`) |
| **Containerization** | Docker | Production container image builds (`Dockerfile`) |

---

## 🚀 Local Setup & Development (From Scratch)

### 1. Prerequisites
- **Node.js**: Version `20.x` or higher (recommended LTS).
- **npm**: Version `10.x` or higher.
- **PostgreSQL**: Local instance running on port `5432` OR Docker installed.

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/hassanmohamed16y-stack/rive-backend.git
cd rive-backend
npm ci
```

### 3. Environment Setup
Copy the environment template and edit `.env` for your local environment:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to a reachable PostgreSQL instance (e.g., `postgresql://postgres:postgres@localhost:5432/rive_backend?schema=public`).

### 4. Database Setup & Migration
Run Prisma migrations and seed initial data (categories, products, and initial admin account):

```bash
# Run database migrations
npx prisma migrate dev

# Seed database (creates default admin and test products)
npm run seed
```

### 5. Start Development Server
```bash
npm run start:dev
```
The server will start at `http://localhost:3000` (or `PORT` specified in `.env`).

---

## 🔐 Environment Variables Reference

Below are all environment variables used by `rive-backend`. Detailed documentation is also maintained in [.env.example](.env.example).

| Variable Name | Required? | Default / Example | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime mode (`development`, `staging`, `production`). |
| `PORT` | Optional | `3000` | Port for the HTTP server. |
| `DATABASE_URL` | **Required** | `postgresql://...` | Connection URL for PostgreSQL DB (Prisma Client). |
| `DIRECT_DATABASE_URL` | Optional | `postgresql://...` | Direct connection URL for migrations when using connection poolers (e.g., Neon). |
| `JWT_SECRET` | **Required** | `min-32-character-secret` | Secret key used for signing & verifying JWT access tokens. |
| `JWT_EXPIRATION` | Optional | `1h` | Token expiration duration (e.g., `1h`, `7d`). |
| `STRIPE_SECRET_KEY` | Optional | `sk_test_...` | Stripe secret API key for checkout sessions & refunds. |
| `STRIPE_WEBHOOK_SECRET` | Optional | `whsec_...` | Stripe webhook signing secret for event verification. |
| `CLOUDINARY_CLOUD_NAME` | Optional | `your-cloud-name` | Cloudinary cloud name for image uploads. |
| `CLOUDINARY_API_KEY` | Optional | `your-api-key` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Optional | `your-api-secret` | Cloudinary API secret. |
| `EMAIL_PROVIDER_API_KEY` | Optional | `re_...` | Resend API key for sending transactional email. |
| `EMAIL_FROM_ADDRESS` | Optional | `no-reply@rive.example.com` | Verified sender email address. |
| `INTERNAL_CRON_SECRET` | Optional | `min-32-character-secret` | Shared secret for `/api/v1/internal/expire-reservations` trigger. |
| `ADMIN_INITIAL_PASSWORD` | Optional | `strong-password` | Admin password used during database seeding. |
| `FRONTEND_URL` | Optional | `http://localhost:3001` | Allowed origin for Customer Storefront CORS requests. |
| `ADMIN_FRONTEND_URL` | Optional | `http://localhost:3002` | Allowed origin for Admin Dashboard CORS requests. |
| `TRUST_PROXY_HOPS` | Optional | `1` | Reverse-proxy hop count for client IP extraction. |

---

## 📂 Folder Structure

```
rive-backend/
├── prisma/               # Prisma ORM schema & database migration history
│   ├── migrations/       # SQL migration steps
│   └── schema.prisma     # Central data models (User, Product, Order, etc.)
├── src/                  # Core application source code
│   ├── audit-log/        # Administrative action auditing & logging
│   ├── auth/             # JWT authentication, guards, roles, password reset
│   ├── categories/       # Category domain logic & endpoints
│   ├── common/           # Shared middleware, filters, guards, and utilities
│   ├── config/           # Environment validation & app initialization settings
│   ├── email/            # Resend transactional email client
│   ├── health/           # Liveness & readiness check endpoint (/health)
│   ├── orders/           # Order creation, inventory reservation, state machine
│   ├── payment/          # Stripe checkout sessions & webhook processing
│   ├── products/         # Catalog management, variants, and stock tracking
│   ├── security/         # Security headers, rate limiting, and hardening
│   ├── upload/           # Cloudinary file upload integration
│   ├── app.config.ts     # Global NestJS configuration (CORS, Pipes, Swagger)
│   ├── app.module.ts     # Root NestJS module assembly
│   └── main.ts           # Application entry point
├── scripts/              # Helper scripts (seed.js, export-openapi.ts, auto-save.sh)
├── docs/                 # Documentation assets & specifications
├── Dockerfile            # Container deployment build configuration
├── openapi.json          # Exported OpenAPI 3.0 specification
└── package.json          # Dependencies & npm build scripts
```

---

## 🧪 Running Tests & Quality Checks

The repository includes test suites covering controllers, services, guards, security configurations, and payment webhooks.

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode during active development
npm run test:watch

# Run ESLint code style and quality check
npm run lint

# Run TypeScript type safety verification
npm run typecheck

# Verify build compilation and Prisma client generation
npm run build
```

---

## 🚢 Deployment (Railway & Neon PostgreSQL)

### Deployment Architecture
- **Database**: [Neon PostgreSQL](https://neon.tech/) (Serverless Postgres with direct connection string and pooled connection string).
- **Backend Host**: [Railway](https://railway.app/) (Containerized app deployment using the repository `Dockerfile`).

### Production Deployment Steps
1. **Provision Database**:
   - Create a PostgreSQL project on Neon.
   - Copy the Pooled Connection String as `DATABASE_URL` and Direct Connection String as `DIRECT_DATABASE_URL`.

2. **Setup Railway Service**:
   - Connect the `rive-backend` GitHub repository to Railway.
   - Configure environment variables in Railway service settings (refer to the Environment Variables section above).
   - Ensure `NODE_ENV=production` and `PORT=3000` (or Railway port).

3. **Database Migrations on Production**:
   - In production, migrations run automatically during deployment via entrypoint or build scripts (`npx prisma migrate deploy`).

4. **Verify Health & Docs**:
   - Test deployment liveness: `GET https://your-railway-url.up.railway.app/health`
   - Test API Swagger docs (if enabled in non-production or staging): `/api/docs`

---

## 🔗 Important Links & References

- **Swagger API Documentation**: `http://localhost:3000/api/docs` (Local) / `/api/docs` (Environment-controlled)
- **OpenAPI 3.0 Specification**: [`openapi.json`](openapi.json)
- **Railway Console**: [Railway Dashboard](https://railway.app/dashboard) *(Access required)*
- **Architecture Specification**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Contributing Guidelines**: [CONTRIBUTING.md](CONTRIBUTING.md)
