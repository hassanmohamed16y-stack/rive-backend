# Active context

**Current focus** (one short paragraph): Admin product variant management now provides audited CRUD mutations and atomic delta-based stock adjustment without changing the order reservation path.

**In progress**:

- [x] Add relational order ownership, reservations, indexes, and migration.
- [x] Implement atomic stock reservation and idempotent release.
- [x] Add unit and PostgreSQL-gated concurrency coverage.
- [x] Add persistent Stripe event idempotency and session reuse.
- [x] Verify raw webhook bodies, signed events, payment lifecycle, and expiry with PostgreSQL.
- [x] Add fail-fast production configuration, health, safe request logging, strict production CORS, and upload middleware limits.
- [x] Verify clean dependency install, migrations, typecheck, lint, all PostgreSQL tests, production runtime, and Docker image build.
- [x] Restrict public product queries to ACTIVE and add protected admin product/order management APIs.
- [x] Add paginated product/category responses, category conflict handling, password complexity, and production Swagger restriction.
- [x] Add runtime Prisma CLI support, trust-proxy configuration, manual seed guidance, and internal-only Compose Postgres networking.
- [x] Add admin actor tracking columns, refresh tokens, email verification tokens, login lockout, and best-effort audit logs.
- [x] Add constant-time guest token comparison and authenticated order cancellation endpoint.
- [x] Add ADMIN-only audited variant creation, update, deletion, and atomic stock adjustment endpoints.

**Decisions (recent)**:

- Stock is decremented with conditional `updateMany` inside the order transaction.
- Only a successful PENDING -> CANCELLED/EXPIRED compare-and-set restores stock.
- Webhooks call OrdersService for centralized payment transition.
- Checkout Sessions use an order-scoped Stripe idempotency key and metadata on the Session and PaymentIntent.
- Verified Checkout events must match the stored `paymentSessionId`; their event ID is persisted in the same transaction as the order transition.
- Concurrent Checkout requests that receive the same Stripe session return the persisted session safely.
- The HTTP webhook path is tested with both the production raw-body middleware and Stripe SDK signature verification.
- Public products always filter to ACTIVE; `DRAFT` and `ARCHIVED` are available only through protected admin listing.
- Categories use soft-safe deletion behavior by translating PostgreSQL FK restrictions to 409; products archive rather than delete.
- Production CORS accepts configured origins and returns a sanitized 403 with request ID for denied origins; health probes are exempt from API throttling.
- Guest order access-token checks now use constant-time comparison; admin mutations persist acting-user ids and write best-effort audit records.
- Manual stock changes use a conditional `updateMany` delta update, so a negative adjustment cannot make a variant stock level negative.

**Open questions**:

- The default VS Code terminal sandbox still lacks its required `rg` binary; direct execution was used for verification.
- A live webhook delivery from a real Stripe account cannot be verified without Stripe account credentials or Stripe CLI.

_Update when the task or branch focus changes._
