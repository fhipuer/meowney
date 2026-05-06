# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Meowney (먀우니)** - 고양이 집사의 자산 배분 관리 대시보드
- 개인 자산 포트폴리오 관리, 일별 자산 추이 추적, 리밸런싱 계산기
- 코드/주석에 고양이 관련 위트 사용 권장 (변수명, 에러 메시지 등)

## 상세 학습 문서

프로젝트의 상세 아키텍처, 코드 흐름, 설계 결정을 학습하려면 아래 문서를 참고하세요:

📖 **[docs/architecture.md](docs/architecture.md)** - 프로젝트 아키텍처 학습 가이드
- DB 스키마 상세 (ERD, 테이블 관계, 마이그레이션 히스토리)
- Backend 서비스 클래스 분석 (AssetService, FinanceService, RebalanceService)
- Frontend 상태 관리 및 컴포넌트 구조
- End-to-End 데이터 흐름 (자산 추가, 대시보드 로딩, 리밸런싱 계산)
- 학습 Q&A (자주 묻는 질문과 코드 위치)

## 기술 스택

### Backend (Python)
- **FastAPI** + **Pydantic v2** + **uvicorn**
- **Supabase** Python client (PostgreSQL)
- **yfinance** - 실시간 주가 조회
- **APScheduler** - 매일 23:00 자산 스냅샷

### Frontend (TypeScript)
- **React** + **Vite** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (API) + **Zustand** (전역 상태)
- **Recharts** - 차트 시각화

### Database
- **Supabase** (PostgreSQL)
- 스키마: `database/schema.sql`

## 주요 명령어

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```

**로컬 개발 서버 포트:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Docker
```bash
docker-compose up -d --build      # 전체 실행
docker-compose logs -f meowney-backend  # 백엔드 로그
```

## 아키텍처

### Backend 구조 (`backend/app/`)
```
main.py          # FastAPI 앱, lifespan (스케줄러)
config.py        # pydantic-settings 환경설정
api/v1/
  router.py      # API 라우터 통합
  assets.py      # GET/POST/PUT/DELETE /api/v1/assets
  dashboard.py   # GET /api/v1/dashboard/summary, /history
services/
  finance_service.py   # yfinance 연동, 비동기 가격 조회
  asset_service.py     # 자산 CRUD, 요약 계산, 리밸런싱
  scheduler_service.py # APScheduler 일일 스냅샷
db/
  supabase.py    # Supabase 클라이언트 싱글톤
models/
  schemas.py     # Pydantic 스키마 (Request/Response)
```

### 데이터 흐름
1. API 요청 → `assets.py` / `dashboard.py`
2. `AssetService` → Supabase 조회
3. `FinanceService` → yfinance로 현재가 조회 (ThreadPoolExecutor)
4. 응답에 `market_value`, `profit_rate` 등 계산 필드 포함

### 스케줄러
- `main.py` lifespan에서 `start_scheduler()` 호출
- 매일 23:00 (Asia/Seoul) `take_daily_snapshot()` 실행
- 모든 포트폴리오의 자산 가치를 `asset_history` 테이블에 저장

## 환경 변수

필수:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Supabase 연결
- `VITE_API_URL` - 프론트엔드 API 주소

선택:
- `SNAPSHOT_HOUR`, `SNAPSHOT_MINUTE` - 스냅샷 시간 (기본 23:00)
- `DEFAULT_USD_KRW_RATE` - USD/KRW 환율 기본값

## DB 스키마 요약

- `portfolios` - 포트폴리오 메타
- `assets` - 보유 자산 (ticker, quantity, average_price)
- `asset_categories` - 자산 카테고리 (국내주식, 해외주식, 현금 등)
- `asset_history` - 일별 스냅샷 (total_value, profit_rate)
- `target_allocations` - 목표 배분 비율

### Frontend 구조 (`frontend/src/`)
```
main.tsx         # 앱 진입점
App.tsx          # 라우터, QueryClientProvider
components/
  ui/            # shadcn/ui 컴포넌트 (Button, Card, Dialog 등)
  layout/        # Header, Sidebar, Layout
  dashboard/     # SummaryCards, PortfolioDonut, AssetTrendChart
  assets/        # AssetList, AssetForm, RebalanceCalculator
hooks/
  useAssets.ts   # 자산 CRUD React Query 훅
  useDashboard.ts # 대시보드/히스토리 훅
lib/
  api.ts         # axios 클라이언트, API 함수
  utils.ts       # cn(), formatKRW(), formatPercent()
store/
  useStore.ts    # Zustand 전역 상태 (다크모드, 사이드바)
pages/
  DashboardPage.tsx, AssetsPage.tsx, RebalancePage.tsx, SettingsPage.tsx
types/
  index.ts       # Asset, DashboardSummary 등 타입 정의
```

### 주요 패턴
- **React Query**: `useAssets()`, `useDashboardSummary()` 훅 사용
- **수익/손실 색상**: 한국식 (빨간색=수익, 파란색=손실) - `getProfitClass()` 유틸
- **경로 별칭**: `@/` → `src/` (tsconfig paths)

## 코드 컨벤션

- 에러 메시지에 고양이 이모지 활용: `"냥? 그런 자산은 없다옹! 🙀"`
- 성공 응답: `"냥~ 성공이다옹! 🐱"`
- 주석에 `냥~` 추가 권장
- Backend: Python 타입 힌트 필수, `ruff` 포맷터 권장
- Frontend: TypeScript strict mode, Prettier 포맷터

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/assets` | 자산 목록 (현재가 포함) |
| POST | `/api/v1/assets` | 자산 추가 |
| PUT | `/api/v1/assets/{id}` | 자산 수정 |
| DELETE | `/api/v1/assets/{id}` | 자산 삭제 |
| GET | `/api/v1/dashboard/summary` | 대시보드 요약 |
| GET | `/api/v1/dashboard/history` | 자산 추이 |
| POST | `/api/v1/dashboard/rebalance` | 리밸런싱 계산 |

## 버전 관리

**중요**: 버전 업데이트 시 아래 파일을 수정해야 합니다.

### 버전 업데이트 방법
1. **`frontend/package.json`** - `version` 필드 수정
   ```json
   "version": "0.6.1"
   ```
   - Vite가 빌드 시 이 버전을 `__APP_VERSION__`으로 주입
   - UI에서 `APP_VERSION` 상수로 자동 표시됨

2. **`deploy/README.md`** - 버전 및 변경 이력 업데이트
   - 상단 "버전" 섹션 업데이트
   - 하단 "변경 이력" 테이블에 추가

### 버전 표시 위치
- 사이드바 하단: `Meowney v{VERSION}`
- 설정 페이지 앱 정보: `버전 {VERSION}`

### 버전 관련 파일
- `frontend/src/lib/version.ts` - 버전 상수 정의
- `frontend/vite.config.ts` - 빌드 시 버전 주입

## 커스텀 스킬

### /deploy - NAS 배포
NAS에 Docker 이미지를 빌드하고 배포합니다.

```bash
# Git Bash에서 실행
./deploy/deploy-to-nas.sh
```

**배포 단계:**
1. Docker 이미지 빌드 (`docker-compose build`)
2. 이미지 압축 (`meowney-images.tar.gz`)
3. SCP로 NAS 업로드
4. SSH로 NAS에서 `update.sh` 실행

**NAS 정보:**
- Host: 192.168.0.9:1024
- Path: `/volume1/homes/fhipuer/meowney/`

## 개발 규칙

### 외부 데이터 소스 사용 시 필수 검증
yfinance 등 외부 라이브러리로 데이터를 가져오는 기능을 구현할 때는 **구현 후 반드시** 실제 반환값을 확인한다.

```bash
# 예시: 구현 전 티커/필드 가용성 확인
cd backend
python -c "import yfinance as yf; info = yf.Ticker('TICKER').info; print(info.get('fieldName'))"
```

- 특정 필드(예: `trailingPE`)가 `None`을 반환할 수 있으므로 구현 전에 실제 데이터 확인 필수
- 대안 티커/소스가 필요한 경우 여러 후보를 테스트한 후 채택
- 프론트엔드 변경 후 TypeScript 타입 체크(`npx tsc --noEmit`) 실행 확인
