#!/bin/bash
# ============================================
# Meowney 로그 확인 스크립트 🐱
# ============================================

set -e
cd "$(dirname "$0")/.."
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi
echo "🐱 Meowney 로그 (Ctrl+C로 종료)"
$COMPOSE logs -f
