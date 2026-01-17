# Meowney (먀우니) 🐱💰

> 고양이 집사의 자산 배분 관리 및 일별 자산 추이 추적 대시보드

**버전**: 0.5.0

## 개요

Meowney는 개인 자산 포트폴리오를 관리하고, 일별 자산 추이를 추적하며, 리밸런싱을 계산해주는 귀여운 자산 관리 서비스입니다.

## 주요 기능

- **대시보드**: 총 자산, 수익률, 시장 현황 (USD/KRW 환율, 코스피, S&P 500) 한눈에 확인
- **자산 관리**: 국내/해외 주식, ETF, 현금 등 다양한 자산 등록 및 실시간 시세 조회
- **자산 추이**: 일별 자산 변동 그래프
- **리밸런싱 계산기**: 목표 배분 비율 설정 및 리밸런싱 제안
  - 허용 오차 비율 설정 가능
  - 그룹별 배분 지원
  - 플랜 저장/불러오기
  - 실시간 파이차트 시각화
  - 보유 자산 선택 UI

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
- Synology NAS 배포 지원

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 Supabase 정보 입력
```

필수 환경변수:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase anon 키

### 2. 데이터베이스 초기화

[Supabase SQL Editor](https://app.supabase.com)에서 `database/schema.sql` 실행

### 3. 로컬 개발

```bash
# 백엔드
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 프론트엔드
cd frontend
npm install
npm run dev
```

### 4. Docker 배포

#### 로컬에서 빌드 & 실행
```bash
docker-compose up -d --build
```

#### NAS/서버 배포 (이미지 전송 방식)

1. 로컬에서 이미지 빌드 및 저장:
```bash
docker-compose build
docker save meowney-meowney-backend meowney-meowney-frontend | gzip > meowney-images.tar.gz
```

2. 서버로 파일 전송 후 이미지 로드:
```bash
docker load < meowney-images.tar.gz
```

3. 환경변수 설정 및 실행:
```bash
cp .env.example .env
# .env 파일 수정
docker-compose up -d
```

자세한 배포 가이드는 [deploy/README.md](deploy/README.md) 참고

## 접속 주소

### 로컬 개발
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8000
- API 문서 (Swagger): http://localhost:8000/docs

### Docker 배포 (로컬)
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000

### NAS 배포 (외부 접속)
- 포트포워딩 설정 후 외부 도메인으로 접속 가능
- 예: http://your-domain.synology.me:3000

## 스크린샷

| 대시보드 | 리밸런싱 |
|---------|---------|
| 자산 현황, 시장 지표, 추이 차트 | 목표 배분 설정 및 리밸런싱 제안 |

## 버전 히스토리

### v0.5.0 (2026-01-18)
- Docker 배포 지원 (Synology NAS)
- 외부 접속 설정 (포트포워딩, DDNS)
- UI 개선: 환율 표시 정리, 차트 Y축 수정, 허용 오차 입력
- 배포 스크립트 (start.sh, stop.sh, update.sh, logs.sh)

### v0.4.0 (2026-01-17)
- 리밸런싱 플랜 시스템 (그룹/개별 배분)
- 실시간 파이차트 시각화
- 보유 자산 선택 모달
- localStorage 자동 저장/복구

### v0.3.0 (2026-01-16)
- 대시보드 시장 현황 (KOSPI, S&P500, VIX, USD/KRW)
- 자산 추이 차트
- 리밸런싱 계산기

## 라이선스

MIT
