#!/bin/sh
set -e

# Apply any pending database migrations, then hand off to the Node process.
# `exec` replaces this shell so Node receives signals (SIGTERM, etc.) directly.
npx prisma migrate deploy
exec node dist/src/main.js
