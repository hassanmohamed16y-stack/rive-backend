# Tech context

**Stack**

- Language / runtime: TypeScript / Node 20
- Framework: NestJS 11
- Package manager: npm
- Major dependencies: Prisma 5, PostgreSQL, Stripe, Passport JWT

**Environment**

- Node / Python / etc. versions:
- Required env vars (names only; no secrets):

**Build & test**

- Commands: `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; PostgreSQL concurrency and payment integration tests require `DATABASE_URL` and `RUN_DATABASE_INTEGRATION_TESTS=true`.

**Constraints**

- Hosting, browser support, API limits: Docker startup uses `prisma migrate deploy`, never `prisma db push`; Compose requires explicit secrets and builds an internal PostgreSQL URL from required database variables.
