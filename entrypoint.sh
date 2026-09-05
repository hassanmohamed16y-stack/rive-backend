#!/bin/sh
set -e

# Apply any pending database migrations on every deploy. Seeding is
# intentionally NOT run here: it must only be executed manually, once, when
# setting up a new environment (`npm run seed`). Running it automatically on
# every deploy previously caused the admin user's passwordHash to be reset
# back to ADMIN_INITIAL_PASSWORD on every deploy, silently reverting any
# password change made via POST /api/v1/auth/change-password. Finally hand
# off to the Node process immediately; `exec` replaces this shell so Node
# receives signals (SIGTERM, etc.) directly.
npx prisma migrate deploy

exec node dist/src/main.js
