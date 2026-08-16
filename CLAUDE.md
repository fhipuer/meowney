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
- **SQLite** 로컬 영구 DB (Supabase SDK는 최초 이관 도구 전용)
- **yfinance** - 실시간 주가 조회
- **APScheduler** - 매일 23:00 자산 스냅샷

### Frontend (TypeScript)
- **React** + **Vite** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (API) + **Zustand** (전역 상태)
- **Recharts** - 차트 시각화

### Database
- **SQLite** (`data/meowney.db`, Git 제외)
- 마이그레이션: `backend/app/db/migrations/`

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
  supabase.py    # 하위 호환 DB 클라이언트 진입점
  sqlite_client.py # SQLite 쿼리/마이그레이션 클라이언트
models/
  schemas.py     # Pydantic 스키마 (Request/Response)
```

### 데이터 흐름
1. API 요청 → `assets.py` / `dashboard.py`
2. `AssetService` → SQLite 조회
3. `FinanceService` → yfinance로 현재가 조회 (ThreadPoolExecutor)
4. 응답에 `market_value`, `profit_rate` 등 계산 필드 포함

### 스케줄러
- `main.py` lifespan에서 `start_scheduler()` 호출
- 매일 23:00 (Asia/Seoul) `take_daily_snapshot()` 실행
- 모든 포트폴리오의 자산 가치를 `asset_history` 테이블에 저장

## 환경 변수

운영 기본값:
- `DATABASE_URL` - 기본값 `sqlite:///./data/meowney.db`

최초 이관 시에만:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`

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

애플리케이션 버전은 Semantic Versioning(`MAJOR.MINOR.PATCH`)을 따른다.

- `PATCH`(세 번째 숫자): 버그 수정, 문구·스타일·설정 조정, 리팩터링 등 하위 호환되는 마이너한 변경 시 자동으로 1 증가시킨다.
- `MINOR`(두 번째 숫자): 사용자에게 보이는 기능 추가 등 하위 호환되는 기능 변경 시 자동으로 1 증가시키고 `PATCH`를 0으로 초기화한다.
- `MAJOR`(첫 번째 숫자): 자동으로 변경하지 않는다. 큰 기능 또는 "메이저 업데이트"라는 일반 표현만으로 올리지 않으며, 사용자가 첫 번째 숫자 또는 SemVer `MAJOR` 변경을 명시적으로 지시할 때만 변경하고 `MINOR`와 `PATCH`를 0으로 초기화한다.
- 하나의 작업 또는 배포에 여러 수정이 포함되면 가장 높은 변경 수준을 기준으로 버전을 한 번만 올린다.
- 버전 변경이 필요한 작업에서는 별도 요청이 없어도 구현과 함께 버전을 갱신한다.

**중요**: 버전 업데이트 시 아래 파일을 수정해야 합니다.

### 버전 업데이트 방법
1. **`frontend/package.json`** - `version` 필드 수정
   ```json
   "version": "1.1.0"
   ```
   - Vite가 빌드 시 이 버전을 `__APP_VERSION__`으로 주입
   - UI에서 `APP_VERSION` 상수로 자동 표시됨

2. **`README.md`** - 문서 상단의 현재 버전과 해당 릴리스 제목 수정

### 버전 표시 위치
- 상단 헤더 로고 옆: `v{VERSION}`
- 사이드바 하단: `Version {VERSION}` (사이드바 레이아웃 사용 시)
- 설정 페이지 앱 정보: `버전 {VERSION}`

### 버전 관련 파일
- `frontend/src/lib/version.ts` - 버전 상수 정의
- `frontend/vite.config.ts` - 빌드 시 버전 주입

## 커스텀 스킬

### /deploy - NAS 배포
사용자가 운영 배포를 명시적으로 요청한 경우 `deploy/NAS_RUNBOOK.md`를 완전히 읽고 따른다.
기본 브랜치는 `main`이며 NAS에는 Git이 없으므로 로컬 소스를 전송해 NAS에서 이미지를 빌드한다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1
```

**배포 단계:**
1. 로컬 `main`, clean worktree, 테스트 확인
2. SQLite 및 코드 백업
3. 검증된 소스 아카이브 전송
4. NAS에서 Docker 이미지 빌드, 마이그레이션, 재시작, health check

**NAS 정보:**
- Host: 192.168.0.9:1024
- Path: `/var/services/homes/fhipuer/meowney/`

## 개발 규칙

### UI 변경 완료 조건

화면·레이아웃·차트·상태 표시를 변경한 작업은 테스트와 빌드 통과만으로 완료 처리하지 않는다. 반드시 실행 중인 백엔드와 프론트엔드를 최신 코드로 다시 띄우고 실제 데이터가 연결된 최종 화면을 직접 확인한다.

- 브라우저에서 변경 대상 화면을 직접 열어 핵심 요소의 존재, 위치, 문구, 여백, 색상과 반응형 레이아웃을 확인한다.
- 차트와 데이터 시각화는 실제 API 응답으로 점·선·화살표·축·범례·날짜가 의도대로 표시되는지 확인한다.
- 정적 렌더링 테스트나 컴포넌트 테스트만으로 시각 검증을 대체하지 않는다.
- 백엔드 응답 계약을 변경했다면 실행 중인 서버가 최신 코드인지 확인하고 실제 API 응답과 화면을 함께 검증한다.
- 가능하면 최종 화면의 스크린샷을 남기거나 브라우저 캡처로 검증하며, 직접 확인하지 못한 경우 완료 보고에 그 제한을 명시한다.
- 화면에서 발견한 문제를 수정한 뒤에는 동일 화면을 다시 열어 재확인한다.

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
