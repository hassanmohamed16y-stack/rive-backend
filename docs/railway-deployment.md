# Deploying to Railway

This guide explains why the service was crashing on Railway (missing environment
variables) and how to configure the project correctly.

## 1. Why the deploy crashed

`validateEnvironment()` (`src/config/environment.validation.ts`) runs at startup via
`src/main.ts` and throws if any production-required variable (including
`DATABASE_URL`) is missing whenever `NODE_ENV` is not a local-only environment
(see `isLocalOnlyEnvironment`). On Railway, `NODE_ENV=production` is set by the
Dockerfile, so the app immediately throws and crashes unless the required
variables are provided as Railway environment variables — they are **not**
read from `.env.example` or any file committed to the repo.

`process.env.PORT` and `DATABASE_URL` themselves are already handled correctly:
- `src/main.ts` calls `app.listen(process.env.PORT ?? 3000)`, so Railway's
  dynamically assigned `PORT` is honored automatically.
- `prisma/schema.prisma` declares `url = env("DATABASE_URL")`, so the Prisma
  client reads the connection string from the environment at runtime — no
  code change is needed there, only the variable must exist on Railway.

## 2. Configure environment variables on Railway

1. Open your project in the [Railway dashboard](https://railway.app/dashboard).
2. Add a PostgreSQL database (**+ New → Database → PostgreSQL**) if you don't
   have one yet. Railway automatically creates a `DATABASE_URL` variable on
   that database service.
3. Select your backend service → **Variables** tab.
4. If the Postgres plugin lives in the same Railway project, click **Add
   Variable Reference** and reference the database's `DATABASE_URL` so it's
   always kept in sync. Otherwise paste the connection string manually.
5. Add the remaining variables required in production (see
   `productionRequiredVariables` in `src/config/environment.validation.ts` and
   `.env.example` for descriptions/formats):
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `JWT_SECRET` (min 32 chars, e.g. `openssl rand -base64 32`)
   - `JWT_EXPIRATION` (e.g. `24h`)
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
   - `FRONTEND_URL` / `ADMIN_FRONTEND_URL`
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
   - `ADMIN_INITIAL_PASSWORD` (min 12 chars)
   - `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM_ADDRESS`
   - `INTERNAL_CRON_SECRET` (min 32 chars)
   - Optionally `TRUST_PROXY_HOPS`, `LOG_LEVEL`
6. Do **not** rely on `PORT` — Railway injects it automatically; the app
   already reads it via `process.env.PORT`.
7. Click **Deploy** (or trigger a redeploy) after saving variables.

## 3. Health checks

`GET /health` (`src/health/health.controller.ts`) runs a `SELECT 1` query
through Prisma and returns `200 { status: "ok" }`, or `503` if the database is
unreachable. There is no global route prefix, so the path is exactly
`/health`.

`railway.json` at the repo root configures Railway to build with the existing
`Dockerfile` and to use this endpoint for health checks:

```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Railway polls `healthcheckPath` after each deploy and only routes traffic to
the new instance once it responds successfully, restarting failed deploys up
to `restartPolicyMaxRetries` times.
