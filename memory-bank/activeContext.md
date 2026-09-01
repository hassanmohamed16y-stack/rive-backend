# Active context

**Current focus** (one short paragraph): Phase 4 production hardening and release verification is complete locally, preserving Phases 1 through 3.

**In progress**:

- [x] Add relational order ownership, reservations, indexes, and migration.
- [x] Implement atomic stock reservation and idempotent release.
- [x] Add unit and PostgreSQL-gated concurrency coverage.
- [x] Add persistent Stripe event idempotency and session reuse.
- [x] Verify raw webhook bodies, signed events, payment lifecycle, and expiry with PostgreSQL.
- [x] Add fail-fast production configuration, health, safe request logging, strict production CORS, and upload middleware limits.
- [x] Verify clean dependency install, migrations, typecheck, lint, all PostgreSQL tests, production runtime, and Docker image build.

**Decisions (recent)**:

- Stock is decremented with conditional `updateMany` inside the order transaction.
- Only a successful PENDING -> CANCELLED/EXPIRED compare-and-set restores stock.
- Webhooks call OrdersService for centralized payment transition.
- Checkout Sessions use an order-scoped Stripe idempotency key and metadata on the Session and PaymentIntent.
- Verified Checkout events must match the stored `paymentSessionId`; their event ID is persisted in the same transaction as the order transition.
- Concurrent Checkout requests that receive the same Stripe session return the persisted session safely.
- The HTTP webhook path is tested with both the production raw-body middleware and Stripe SDK signature verification.
- Production CORS accepts configured origins and returns a sanitized 403 with request ID for denied origins; health probes are exempt from API throttling.

**Open questions**:

- The default VS Code terminal sandbox still lacks its required `rg` binary; direct execution was used for verification.
- A live webhook delivery from a real Stripe account cannot be verified without Stripe account credentials or Stripe CLI.

_Update when the task or branch focus changes._
