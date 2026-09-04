# RIVE Backend

NestJS API for the RIVE storefront. Production startup requires the variables documented in [.env.example](.env.example), then runs:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

`GET /health` verifies that the application and PostgreSQL are reachable.

## Frontend API Contract

- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` return `{ accessToken, user }`; user objects never contain `passwordHash`.
- `GET /api/v1/auth/me` requires `Authorization: Bearer <accessToken>`.
- `GET /api/v1/products` accepts optional `category`, `isFeatured`, `search`, `page` and `limit` query parameters. `page >= 1` and `1 <= limit <= 100`.
- `GET /api/v1/products/:slug` returns the product or a sanitized `404` error.
- `POST /api/v1/orders` accepts either no authentication for guest checkout or a bearer token for ownership. It returns a guest access token only for guest orders.
- `GET /api/v1/orders/:orderNumber` and `POST /api/v1/payments/create-checkout-session` require either the order owner's bearer token, an admin bearer token, or `X-Order-Access-Token` for a guest order.
- `POST /api/v1/payments/webhook` is Stripe-only. It requires the `stripe-signature` header and raw JSON body; clients must never use the frontend success URL as payment proof.

API documentation is available at `/api/docs`.

## Environment Variables

All required and optional environment variables are documented in [.env.example](.env.example) and
validated at startup by `src/config/environment.validation.ts`. Outside local development/test,
`DATABASE_URL`, `JWT_SECRET`, Stripe, Cloudinary, email, and internal-cron secrets are mandatory and
checked for minimum length/format before the application boots.

For production, point `DATABASE_URL` at a pooled connection (e.g. PgBouncer in front of PostgreSQL,
or your managed Postgres provider's built-in pooler) rather than a direct database connection, since
Prisma opens a connection pool per instance and can exhaust database connections under horizontal
scaling without an external pooler.

## Project Structure

Each feature lives under `src/<feature>/` with a consistent layout:

```
src/<feature>/
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.module.ts
  dto/
```

See [docs/architecture.md](docs/architecture.md) for notes on the order lifecycle, payment
processing, authentication, auditing, and rate limiting.

## Git Auto-Save

Run `npm run save` to stage all repository changes, create an `Auto-save: YYYY-MM-DD HH:MM:SS` commit, and push the active branch to its configured remote. The command exits successfully when there are no changes and exits non-zero if staging, committing, or pushing fails.

VS Code exposes the same command as the default Build Task. Use `Ctrl+Shift+B` and select `Git: Auto Save and Push` when prompted. It is intentionally not triggered on every file save because it creates and pushes commits.
