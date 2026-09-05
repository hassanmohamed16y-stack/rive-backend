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

## Git Auto-Save

Run `npm run save` to stage all repository changes, create an `Auto-save: YYYY-MM-DD HH:MM:SS` commit, and push the active branch to its configured remote. The command exits successfully when there are no changes and exits non-zero if staging, committing, or pushing fails.

VS Code exposes the same command as the default Build Task. Use `Ctrl+Shift+B` and select `Git: Auto Save and Push` when prompted. It is intentionally not triggered on every file save because it creates and pushes commits.
