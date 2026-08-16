#!/bin/sh
set -eu

ARCHIVE="${1:?source archive path is required}"
EXPECTED_SHA="${2:?sha256 is required}"
TARGET="/var/services/homes/fhipuer/meowney"
STARTED_AT=$(date +%s)
HISTORY_FILE="$TARGET/backups/deployment-history.log"

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

elapsed() {
  NOW=$(date +%s)
  echo "$((NOW - STARTED_AT))"
}

step() {
  echo "$1 (경과: $(elapsed)초)"
}

record_failure() {
  STATUS=$?
  trap - HUP INT TERM EXIT
  printf '%s status=failed elapsed_seconds=%s\n' \
    "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$(elapsed)" >> "$HISTORY_FILE"
  exit "$STATUS"
}

trap record_failure HUP INT TERM EXIT

step "1. SQLite 온라인 백업"
$COMPOSE exec -T meowney-backend python scripts/backup_sqlite.py \
  --source /data/meowney.db \
  --destination "/backups/meowney-pre-release-$STAMP.db"

step "2. 현재 코드 백업"
tar --exclude='./data' --exclude='./backups' --exclude='./.env' \
  -czf "backups/code-pre-release-$STAMP.tar.gz" .

step "3. 새 소스 적용 및 이미지 빌드"
tar -xzf "$ARCHIVE" -C "$TARGET"
chmod 755 deploy/*.sh
$COMPOSE build

step "4. DB 마이그레이션 및 컨테이너 교체"
$COMPOSE run --rm meowney-backend python -c \
  "from app.db.database import get_database_client; get_database_client().migrate()"
$COMPOSE up -d --remove-orphans

step "5. 상태 및 데이터 검증"
HEALTHY=0
ATTEMPT=1
while [ "$ATTEMPT" -le 24 ]; do
  if curl --silent --show-error --fail http://localhost:8000/health >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  echo "  서비스 기동 대기 중: ${ATTEMPT}/24 (경과: $(elapsed)초)"
  ATTEMPT=$((ATTEMPT + 1))
  sleep 5
done
test "$HEALTHY" -eq 1
sqlite3 data/meowney.db < database/verify-sqlite.sql
$COMPOSE ps
rm -f "$ARCHIVE"
ELAPSED=$(elapsed)
printf '%s status=success elapsed_seconds=%s\n' \
  "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$ELAPSED" >> "$HISTORY_FILE"
AVERAGE=$(tail -n 5 "$HISTORY_FILE" | awk -F= '/status=success/ { sum += $3; count += 1 } END { if (count) printf "%d", sum / count; else print 0 }')
trap - HUP INT TERM EXIT
echo "RELEASE_APPLIED=$STAMP ELAPSED_SECONDS=$ELAPSED RECENT_AVERAGE_SECONDS=$AVERAGE"
