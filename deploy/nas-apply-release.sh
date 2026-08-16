#!/bin/sh
set -eu

ARCHIVE="${1:?source archive path is required}"
EXPECTED_SHA="${2:?sha256 is required}"
TARGET="/var/services/homes/fhipuer/meowney"

export PATH=/usr/local/bin:$PATH

test "$TARGET" = "/var/services/homes/fhipuer/meowney"
test -d "$TARGET"
test -f "$ARCHIVE"
echo "$EXPECTED_SHA  $ARCHIVE" | sha256sum -c -
docker ps >/dev/null

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

STAMP=$(date +%Y%m%d-%H%M%S)
cd "$TARGET"
mkdir -p data backups

echo "1. SQLite 온라인 백업"
$COMPOSE exec -T meowney-backend python scripts/backup_sqlite.py \
  --source /data/meowney.db \
  --destination "/backups/meowney-pre-release-$STAMP.db"

echo "2. 현재 코드 백업"
tar --exclude='./data' --exclude='./backups' --exclude='./.env' \
  -czf "backups/code-pre-release-$STAMP.tar.gz" .

echo "3. 새 소스 적용 및 이미지 빌드"
tar -xzf "$ARCHIVE" -C "$TARGET"
chmod 755 deploy/*.sh
$COMPOSE build

echo "4. DB 마이그레이션 및 컨테이너 교체"
$COMPOSE run --rm meowney-backend python -c \
  "from app.db.supabase import get_supabase_client; get_supabase_client().migrate()"
$COMPOSE up -d --remove-orphans

echo "5. 상태 및 데이터 검증"
curl --fail --retry 12 --retry-delay 5 http://localhost:8000/health >/dev/null
sqlite3 data/meowney.db < database/verify-sqlite.sql
$COMPOSE ps
rm -f "$ARCHIVE"
echo "RELEASE_APPLIED=$STAMP"
