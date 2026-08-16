#!/bin/bash
# ============================================
# Meowney 중지 스크립트 🐱
# ============================================

set -e
cd "$(dirname "$0")/.."
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi
echo "🐱 Meowney 중지..."
$COMPOSE down
echo "🐱 중지 완료!"
