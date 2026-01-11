# Meowney (먀우니) 🐱💰

> 고양이 집사의 자산 배분 관리 및 일별 자산 추이 추적 대시보드

## 개요

Meowney는 개인 자산 포트폴리오를 관리하고, 일별 자산 추이를 추적하며, 리밸런싱을 계산해주는 귀여운 자산 관리 서비스입니다.

## 기술 스택

### Frontend
- React + TypeScript (Vite)
- Tailwind CSS + shadcn/ui
- TanStack Query + Zustand
- Recharts

### Backend
- Python 3.11+ / FastAPI
- yfinance (실시간 주가)
- APScheduler (일일 스냅샷)
- Supabase (PostgreSQL)

### DevOps
- Docker & Docker Compose

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 Supabase 정보 입력
```

### 2. 데이터베이스 초기화

[Supabase SQL Editor](https://app.supabase.com)에서 `database/schema.sql` 실행

### 3. 로컬 개발

```bash
# 백엔드
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 프론트엔드
cd frontend
npm install
npm run dev
```

### 4. Docker 배포

```bash
docker-compose up -d --build
```

## API 문서

개발 모드에서 `/docs` (Swagger UI) 접속

## 라이선스

MIT
