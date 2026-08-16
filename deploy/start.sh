#!/bin/bash
# ============================================
# Meowney 시작 스크립트 🐱
# ============================================

set -e
cd "$(dirname "$0")/.."
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi
echo "🐱 Meowney 시작..."
$COMPOSE up -d
$COMPOSE ps
echo "🐱 시작 완료! http://192.168.0.9:3000"
