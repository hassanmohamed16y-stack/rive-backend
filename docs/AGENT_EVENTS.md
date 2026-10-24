# AI agent link (backend side)

Implements `rive-agent-kit/contract/EVENTS_CONTRACT.md` v1.

## What it does

1. **Backend → agent events.** Every order, payment, stock and admin-login change writes an event
   to the `AgentOutbox` table *inside the same database transaction* as the change. If the
   order rolls back, the event disappears with it. If the outbox write itself fails, a
   SAVEPOINT drops only the event and the order still goes through: the agent can never
   break checkout.
2. **Delivery.** `POST /api/v1/internal/agent-events/dispatch` (or `GET` for Vercel Cron)
   signs and posts due events to `{AGENT_BASE_URL}/webhook/rive-events`. Run it every minute
   with the existing `INTERNAL_CRON_SECRET` (header `x-internal-cron-secret` or
   `Authorization: Bearer`). Retries: 1m, 5m, 30m, 2h, 6h, 12h, then `failed`. 400/401 are
   not retried. After each change the backend also tries one immediate send (max 3 s).
3. **Agent → backend API** at `/api/v1/agent/*` with `Authorization: Bearer AGENT_SERVICE_TOKEN`.
   Every POST needs an `Idempotency-Key` header; a repeated key returns the first answer.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/agent/health` | token check |
| GET | `/api/v1/agent/orders?status=&since=&limit=` | backend statuses, `since` = ISO date (updatedAt) |
| GET | `/api/v1/agent/orders/:idOrNumber` | full order in contract shape |
| POST | `/api/v1/agent/orders/:id/status` `{to, reason?}` | only CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED. PAID / REFUNDED → **403** (owner approval needed). Same transition rules as the admin panel. Audited as `agent.order.status`. |
| POST | `/api/v1/agent/orders/:id/notes` `{content}` | internal note shown in admin, prefixed `[AI]` |
| GET | `/api/v1/agent/payments?since=` | card payments for reconciliation |

4. **Admin** (ADMIN + `automation.view` / `automation.edit`):
   `GET /api/v1/admin/agent-events/stats`, `GET /api/v1/admin/agent-events?status=&page=`,
   `POST /api/v1/admin/agent-events/:id/resend`.

## Events sent now

| type | from |
|---|---|
| `order.created` | checkout (website) |
| `order.status_changed` | admin transitions, customer cancel, reservation expiry, Paymob success/failure, reconciliation, refund |
| `order.cancelled` | any → CANCELLED / EXPIRED (sent together with `status_changed`) |
| `stock.changed` | sale (checkout) and restock on cancel/expiry |
| `payment.succeeded` | Paymob webhook, reconciliation repair, COD collected (`provider: "cod"`) |
| `payment.failed` | Paymob webhook (declined) |
| `payment.refunded` | admin refund through Paymob |
| `admin.login` | admin accounts only: success, wrong password, locked |

Not yet: `customer.consent_changed` (no consent field in the schema yet). UTM is stored on the order
(`utmSource/Medium/Campaign/Content`) and sent in `order.created.utm` once the store sends it. Shipping events wait for the carrier (D9).

## Switches (env)

| var | default | meaning |
|---|---|---|
| `AGENT_EVENTS_ENABLED` | off | `true` = send. Off still records, so nothing is lost. |
| `AGENT_BASE_URL` | – | n8n base URL, https |
| `RIVE_AGENT_WEBHOOK_SECRET` | – | HMAC secret, ≥ 32 chars |
| `AGENT_EVENTS_TEST` | – | `true` marks every event `test: true` |
| `AGENT_SERVICE_TOKEN` | – | agent API token, ≥ 32 chars; empty = API off (503) |

Startup validation only checks these when `AGENT_EVENTS_ENABLED=true` or a token is set, so
existing deployments start exactly as before.

## Database

Migration `20261024000000_add_agent_outbox` adds two tables (`AgentOutbox`, `AgentRequest`) and
touches nothing else. Delivered events are kept 7 days, failed 30 days, idempotency records 7 days.
