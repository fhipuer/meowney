#!/bin/bash
# ============================================
# Meowney NAS 배포 스크립트 냥~ 🐱
# Windows Git Bash에서 실행
# ============================================

set -e

# 설정
NAS_HOST="192.168.0.9"
NAS_PORT="1024"
NAS_USER="fhipuer"
NAS_PATH="/volume1/homes/fhipuer/meowney"
IMAGE_FILE="meowney-images.tar.gz"
PROJECT_DIR="c:/Miz/Project/meowney"

echo "🐱 Meowney NAS 배포 시작!"
echo "========================================"

# Step 1: Docker 이미지 빌드
echo ""
echo "📦 Step 1: Docker 이미지 빌드 중..."
cd "$PROJECT_DIR"
docker-compose build

# Step 2: 이미지 저장 및 압축
echo ""
echo "💾 Step 2: 이미지 저장 및 압축 중..."
docker save meowney-meowney-backend:latest meowney-meowney-frontend:latest | gzip > "$IMAGE_FILE"
echo "   생성됨: $IMAGE_FILE ($(du -h $IMAGE_FILE | cut -f1))"

# Step 3: NAS에 업로드 (SSH cat 방식 - SCP subsystem 문제 우회)
echo ""
echo "📤 Step 3: NAS에 업로드 중... (비밀번호 입력 필요)"
cat "$IMAGE_FILE" | ssh -p "$NAS_PORT" "${NAS_USER}@${NAS_HOST}" "cat > ${NAS_PATH}/${IMAGE_FILE}"

# 정리
echo ""
echo "🧹 로컬 이미지 파일 정리..."
rm -f "$IMAGE_FILE"

echo ""
echo "========================================"
echo "🐱 업로드 완료! 냥~"
echo ""
echo "📋 NAS에서 수동으로 업데이트 실행:"
echo "   ssh -p ${NAS_PORT} ${NAS_USER}@${NAS_HOST}"
echo "   cd ${NAS_PATH} && ./update.sh"
