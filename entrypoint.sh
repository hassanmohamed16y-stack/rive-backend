#!/bin/sh
set -e

# Apply any pending database migrations, then seed baseline data (admin user
# + categories/products) in the background so a slow or failing seed can
# never delay or crash app startup — Railway (and similar platforms) expect
# the process to bind to $PORT quickly, and will report "Application failed
# to respond" if that takes too long. `scripts/seed.js` uses upserts, so it
# is safe to run on every deploy — it never duplicates rows and simply keeps
# the baseline data in sync. Finally hand off to the Node process
# immediately; `exec` replaces this shell so Node receives signals
# (SIGTERM, etc.) directly.
npx prisma migrate deploy

(node scripts/seed.js || true) &

exec node dist/src/main.js
