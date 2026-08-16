#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH=/usr/local/bin:$PATH

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo "1. Git 변경사항 확인 및 최신 코드 받기"
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "작업 트리에 변경사항이 있어 안전하게 중단합니다."
    exit 1
  fi
  git pull --ff-only
else
  echo "Git 저장소가 아니므로 pull을 건너뜁니다. 전송된 현재 소스를 사용합니다."
fi

mkdir -p data backups
if [ -f data/meowney.db ]; then
  echo "2. 운영 DB 온라인 백업"
  $COMPOSE run --rm meowney-backend python scripts/backup_sqlite.py \
    --source /data/meowney.db --destination "/backups/meowney-$(date +%Y%m%d-%H%M%S).db"
else
  echo "2. 신규 설치: 백업할 DB 없음"
fi

echo "3. 이미지 빌드 및 DB 마이그레이션"
$COMPOSE build
$COMPOSE run --rm meowney-backend python -c \
  "from app.db.database import get_database_client; get_database_client().migrate()"

echo "4. 서비스 교체 및 상태 확인"
$COMPOSE up -d --remove-orphans
$COMPOSE ps
curl --fail --retry 12 --retry-delay 5 http://localhost:8000/health >/dev/null
echo "Meowney 업데이트 완료"
