# Progress

**What works**

- Phase 1 security controls remain in place.
- Phase 2 order reservation lifecycle, schema constraints, migration, and tests implemented and verified.
- Phase 3 Stripe Checkout idempotency, verified raw webhooks, persistent event idempotency, and payment-flow integration tests implemented and verified.
- Checkout-session persistence race handled and verified with focused Stripe tests.
- Stripe SDK cryptographic webhook-signature acceptance is verified locally; invalid signatures remain covered.
- HTTP integration verifies that the production raw-body middleware passes a Stripe SDK-signed request through the controller to the PAID transition.
- Phase 4 added production environment validation, `/health`, safe request ID logging, strict production CORS, Multer limits, pagination DTO validation, reproducible Docker/npm deployment, and dependency remediation.
- Verified locally: `npm ci`, Prisma generate/migrations, typecheck, lint, 56 tests including PostgreSQL integrations, production startup and health/CORS, Docker image build, and zero production dependency audit vulnerabilities.
- Added public ACTIVE-product filtering, admin product/order/category API operations, standard pagination metadata, password complexity, production Swagger restriction, and Docker dev-dependency pruning. Final verification: Prisma valid/up-to-date, typecheck/lint/build pass, 64 tests pass, Docker image build passes.
- Added runtime Prisma CLI support after `npm prune --omit=dev`, trust-proxy configuration, internal-only Compose Postgres networking, constant-time guest token comparison, protected order cancellation by order number, admin product/order detail APIs, category featured filtering, admin actor tracking columns, email verification tokens, rotating refresh tokens, login lockout, and best-effort audit logging. Final verification: `npm run typecheck` and `npm test` pass with 68 tests passing and 3 PostgreSQL-gated skips.
- Added ADMIN-only product-variant creation, price/color/availability update, FK-safe deletion, and audited conditional delta stock adjustment. Focused typecheck, lint, and unit coverage pass; PostgreSQL concurrency coverage is gated by the existing integration-test environment variables.

**Not started / backlog**

- Live Stripe-account webhook delivery remains a deployment-environment verification item.

**Known issues**

- Default VS Code sandboxed terminal reports missing `rg`; direct execution works. Node emits a third-party `url.parse()` deprecation warning during some tests.
- A real Stripe CLI/account test is unavailable in this workspace; Stripe SDK cryptographic and HTTP-path tests pass locally.

_Keep bullets factual and small; link issues or PRs when useful._
