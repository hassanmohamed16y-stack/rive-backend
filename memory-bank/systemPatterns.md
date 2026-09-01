# System patterns

Document **architecture** and **recurring patterns** so Copilot stays aligned.

- **High-level layout** (modules, services, boundaries): Nest modules use PrismaService; OrdersService owns inventory reservations and state transitions; PaymentService delegates payment state changes to it.
- **Data flow**: Create order -> transactionally conditional-decrement variant stock -> create PENDING order with expiration -> idempotent Stripe Checkout -> signed webhook creates persistent event record and marks PAID or releases reservation atomically.
- **Patterns to follow** (naming, error handling, testing style): Use Prisma interactive transactions and `updateMany` conditions for state/stock compare-and-set operations; verify Stripe signatures before reads; use a unique processed-event record for webhook retries; Jest specs with mocked Prisma plus optional PostgreSQL integration tests.
- **Patterns to avoid**: Read/check/update inventory sequences, client-supplied prices, direct order status updates outside OrdersService, and processing webhook payloads before signature verification.

- Concurrent Checkout creation that returns the same Stripe idempotency-key result must re-read and return the stored session instead of reporting an avoidable error.
- Webhook signature tests use Stripe SDK test-header generation and the production `constructEvent` path, rather than mocking successful signature verification.
- Production startup validates all required configuration, public `/health` performs a Prisma reachability query, and request logs/errors use a request ID without recording payloads or authorization headers.
- Public product queries always scope to `ProductStatus.ACTIVE`; administrative status visibility uses controllers protected with both JWT and ADMIN role guards. List APIs return `{ data, meta: { page, limit, total, totalPages } }`.

_Link to key files or packages when it saves repetition._
