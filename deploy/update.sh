#!/bin/bash
# ============================================
# Meowney 업데이트 스크립트 🐱
# 새 이미지 로드 후 컨테이너 재시작
# ============================================

echo "🐱 Meowney 업데이트 시작..."

# 기존 컨테이너 중지
echo "1. 컨테이너 중지 중..."
sudo docker-compose down

# 새 이미지 로드
echo "2. 새 이미지 로드 중..."
sudo docker load < meowney-images.tar.gz

# 컨테이너 재시작
echo "3. 컨테이너 시작 중..."
sudo docker-compose up -d

# 상태 확인
echo "4. 상태 확인..."
sudo docker-compose ps

echo "🐱 업데이트 완료!"
