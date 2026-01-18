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
NAS_PATH="/var/service/homes/fhipuer/meowney"
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

# Step 3: NAS에 업로드
echo ""
echo "📤 Step 3: NAS에 업로드 중... (비밀번호 입력 필요)"
scp -P "$NAS_PORT" "$IMAGE_FILE" "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/"

# Step 4: NAS에서 업데이트 실행
echo ""
echo "🔄 Step 4: NAS에서 업데이트 실행 중... (비밀번호 입력 필요)"
ssh -p "$NAS_PORT" "${NAS_USER}@${NAS_HOST}" "cd ${NAS_PATH} && ./update.sh"

# 정리
echo ""
echo "🧹 로컬 이미지 파일 정리..."
rm -f "$IMAGE_FILE"

echo ""
echo "========================================"
echo "🐱 배포 완료! 냥~"
echo "   Frontend: http://${NAS_HOST}:3000"
echo "   Backend:  http://${NAS_HOST}:8000"
