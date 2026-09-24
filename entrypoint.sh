#!/bin/sh
set -e

# Apply any pending database migrations before starting the server.
# Seeding is decoupled from automatic startup and can be triggered manually via
# `npm run seed:once` when needed.
# Finally hand off to the Node process immediately; `exec` replaces this shell
# so Node receives signals (SIGTERM, etc.) directly.
npx prisma migrate deploy

exec node dist/src/main.js
