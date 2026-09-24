#!/bin/sh
set -e

# Apply any pending database migrations, then seed baseline data before starting
# the server. `scripts/seed.js` uses upserts, so it is safe to run on every
# deploy — it never duplicates rows and simply keeps the baseline data in sync.
# Finally hand off to the Node process immediately; `exec` replaces this shell
# so Node receives signals (SIGTERM, etc.) directly.
npx prisma migrate deploy
npx prisma db seed

exec node dist/src/main.js
