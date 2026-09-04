# Architecture Notes

## Order lifecycle

Orders move through `PENDING -> PAID -> ...` state transitions backed by database constraints and a
reservation mechanism: stock is reserved atomically when an order is created and released by an
internal cron endpoint (`POST /api/v1/internal/expire-reservations`) when a reservation expires
without payment. The endpoint is authenticated with a shared secret (`INTERNAL_CRON_SECRET`)
compared using a constant-time check instead of JWT, since it is called by the scheduler rather
than a logged-in user.

## Payments

Stripe Checkout Sessions are created per order and payment confirmation happens exclusively through
the verified webhook (`POST /api/v1/payments/webhook`), never through client-supplied "success" URLs.
Webhook events are deduplicated via `ProcessedStripeEvent` records so retried deliveries cannot double
process a payment.

## AuthN/AuthZ

- JWT access tokens plus rotating refresh tokens (hashed at rest, never stored in plaintext).
- Password reset and email verification tokens are hashed before persistence; the raw token is only
  ever returned in an API response in local development/test environments.
- All admin-only routes are guarded by `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')`.
- Every environment other than local development/test (`isLocalOnlyEnvironment()`) is treated as a
  real deployment: this disables Swagger, restricts CORS to configured origins, and enforces strict
  environment variable validation (see `src/config/environment.validation.ts`).

## Auditing

Administrative mutations (product/category/order changes, etc.) are recorded through the global
`AuditLogService`. Audit logging is fail-open by design: a logging failure is reported via the
application logger but does not block the underlying business operation.

## Rate limiting

Sensitive endpoints (login, registration, password reset, checkout session creation, payment
webhook, internal cron) are protected by `@nestjs/throttler` with per-route limits in addition to
the global default.
