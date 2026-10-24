#!/usr/bin/env bash
# OPTIONAL: copy the current data (from Prisma Postgres) into the server database.
# Usage (as root, after setup.sh):
#   bash /opt/rive/rive-backend/deploy/import-db.sh 'postgres://USER:PASS@HOST:5432/DB?sslmode=require'
# The URL is the *direct* connection string from the Prisma Console (not the prisma+postgres:// one).
# This REPLACES everything currently in the server's store database.
set -euo pipefail
SRC=${1:-}
[ -n "$SRC" ] || { echo "اكتب رابط قاعدة البيانات القديمة بعد اسم السكربت"; exit 1; }
cd /opt/rive/rive-backend/deploy
set -a; . ./.env; set +a

read -r -p "ده هيمسح بيانات المتجر الحالية على السيرفر ويحط مكانها البيانات القديمة. متأكد؟ (اكتب نعم): " OK
[ "$OK" = "نعم" ] || { echo "اتلغى."; exit 1; }

mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M)
echo "==> نسخة احتياطية من الموجود قبل الاستيراد"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -U rive -d rive -Fc > "backups/before-import-$STAMP.dump"

echo "==> سحب البيانات القديمة"
docker compose exec -T postgres pg_dump --no-owner --no-privileges -Fc "$SRC" > "backups/import-$STAMP.dump"

echo "==> إيقاف الباك اند مؤقتًا واستبدال البيانات"
docker compose stop backend cron
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -U rive -d rive -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_restore -U rive -d rive --no-owner --no-privileges < "backups/import-$STAMP.dump" || true

echo "==> تشغيل الباك اند (هيطبّق أي تحديثات قاعدة بيانات ناقصة)"
docker compose up -d backend cron
echo "تم. لو حاجة باظت، النسخة القديمة في deploy/backups/before-import-$STAMP.dump"
echo "ملحوظة: لو كان فيه حد مفعّل التحقق الثنائي (2FA)، حط TWO_FACTOR_ENCRYPTION_KEY القديم من Vercel في deploy/.env وشغّل update.sh"
