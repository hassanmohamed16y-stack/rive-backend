#!/usr/bin/env bash
# Pull the latest code of all three repos and rebuild what changed.
# Run as root on the server:  bash /opt/rive/rive-backend/deploy/update.sh
set -euo pipefail
BASE=/opt/rive
for REPO in rive-backend rive-admin rive-store; do
  echo "==> $REPO"
  git -C "$BASE/$REPO" pull -q --ff-only origin main
done
cd "$BASE/rive-backend/deploy"
docker compose build --pull
docker compose up -d
docker image prune -f >/dev/null
docker compose ps
