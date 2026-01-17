#!/bin/bash
# ============================================
# Meowney 시작 스크립트 🐱
# ============================================

echo "🐱 Meowney 시작..."
sudo docker-compose up -d
sudo docker-compose ps
echo "🐱 시작 완료! http://192.168.0.9:3000"
