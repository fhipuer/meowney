# Meowney 프로젝트 아키텍처 학습 가이드

> 이 문서는 Meowney 프로젝트의 전체 구조를 이해하기 위한 학습 가이드입니다.
> 각 계층의 설계 의도와 코드 동작 원리를 상세히 설명합니다.

---

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [Database 계층](#2-database-계층)
3. [Backend 계층](#3-backend-계층)
4. [Frontend 계층](#4-frontend-계층)
5. [End-to-End 데이터 흐름](#5-end-to-end-데이터-흐름)
6. [학습 Q&A](#6-학습-qa)

---

## 1. 전체 아키텍처 개요

### 1.1 기술 스택

| 계층 | 기술 | 용도 |
|------|------|------|
| **Frontend** | React + TypeScript + Vite | SPA 클라이언트 |
| | Tailwind CSS + shadcn/ui | UI 컴포넌트 |
| | TanStack Query (React Query) | 서버 상태 관리 |
| | Zustand | 클라이언트 상태 관리 |
| | Recharts | 차트 시각화 |
| **Backend** | FastAPI + Python | REST API 서버 |
| | Pydantic v2 | 데이터 검증/직렬화 |
| | APScheduler | 스케줄링 (일일 스냅샷) |
| | yfinance | 실시간 주가/환율 조회 |
| **Database** | Supabase (PostgreSQL) | 클라우드 데이터베이스 |

### 1.2 3-Tier 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Dashboard │  │ Assets   │  │Rebalance │  │ Settings │        │
│  │  Page    │  │  Page    │  │  Page    │  │  Page    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐         │
│  │              React Query + Zustand                │         │
│  │         (서버 상태 캐싱 + UI 상태 관리)            │         │
│  └─────────────────────┬─────────────────────────────┘         │
│                        │ Axios                                  │
└────────────────────────┼────────────────────────────────────────┘
                         │ HTTP (REST API)
┌────────────────────────┼────────────────────────────────────────┐
│                        ▼                                        │
│                   BACKEND (FastAPI)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API Layer (v1/)                       │   │
│  │  assets.py │ dashboard.py │ rebalance.py │ settings.py  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┴───────────────────────────────┐   │
│  │                   Service Layer                          │   │
│  │  AssetService │ FinanceService │ RebalanceService       │   │
│  └──────┬────────────────┬────────────────┬────────────────┘   │
│         │                │                │                     │
│         ▼                ▼                │                     │
│    Supabase         yfinance             │                     │
│    (DB Client)      (주가/환율)           │                     │
└─────────┼────────────────────────────────┼─────────────────────┘
          │                                │
┌─────────┼────────────────────────────────┼─────────────────────┐
│         ▼                                │                      │
│                   DATABASE (PostgreSQL)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐    │
│  │ portfolios │  │   assets   │  │   rebalance_plans      │    │
│  │            │  │            │  │   plan_allocations     │    │
│  │            │  │            │  │   allocation_groups    │    │
│  └────────────┘  └────────────┘  └────────────────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐    │
│  │asset_history│ │asset_categories│ │    user_settings    │    │
│  └────────────┘  └────────────┘  └────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 디렉토리 구조

```
meowney/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI 앱 진입점, 스케줄러 시작
│       ├── config.py            # 환경설정 (pydantic-settings)
│       ├── api/v1/
│       │   ├── router.py        # 라우터 통합
│       │   ├── assets.py        # 자산 CRUD API
│       │   ├── dashboard.py     # 대시보드/히스토리 API
│       │   ├── rebalance.py     # 리밸런싱 플랜 API
│       │   └── settings.py      # 사용자 설정 API
│       ├── services/
│       │   ├── asset_service.py     # 자산 비즈니스 로직
│       │   ├── finance_service.py   # yfinance 연동
│       │   ├── rebalance_service.py # 리밸런싱 로직
│       │   └── scheduler_service.py # 일일 스냅샷
│       ├── models/
│       │   └── schemas.py       # Pydantic 스키마
│       └── db/
│           └── supabase.py      # Supabase 클라이언트
├── frontend/
│   └── src/
│       ├── main.tsx             # React 진입점
│       ├── App.tsx              # 라우터 설정
│       ├── pages/               # 페이지 컴포넌트
│       ├── components/
│       │   ├── ui/              # shadcn/ui 컴포넌트
│       │   ├── layout/          # 레이아웃 (Header, Sidebar)
│       │   ├── dashboard/       # 대시보드 컴포넌트
│       │   ├── assets/          # 자산 관련 컴포넌트
│       │   └── rebalance/       # 리밸런싱 컴포넌트
│       ├── hooks/               # React Query 훅
│       ├── store/               # Zustand 스토어
│       ├── lib/
│       │   ├── api.ts           # Axios API 클라이언트
│       │   └── utils.ts         # 유틸리티 함수
│       └── types/
│           └── index.ts         # TypeScript 타입 정의
└── database/
    ├── schema.sql               # 메인 스키마
    └── migrations/              # 마이그레이션 파일
```

---

## 2. Database 계층

### 2.1 ERD (Entity Relationship Diagram)

```
┌─────────────────┐
│   portfolios    │
├─────────────────┤
│ id (PK, UUID)   │
│ name            │
│ base_currency   │
│ target_value    │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌──────────────────┐
│     assets      │       │ asset_categories │
├─────────────────┤       ├──────────────────┤
│ id (PK, UUID)   │  N:1  │ id (PK, UUID)    │
│ portfolio_id(FK)│───────│ name (UNIQUE)    │
│ category_id(FK) │       │ color            │
│ name            │       │ icon             │
│ ticker          │       └──────────────────┘
│ quantity        │
│ average_price   │
│ currency        │
│ current_value   │  ← 수동 입력 자산용
│ purchase_exchange_rate │ ← USD 자산용
│ is_active       │
└────────┬────────┘
         │
         │ 참조
         ▼
┌──────────────────────┐
│   rebalance_plans    │
├──────────────────────┤
│ id (PK, UUID)        │
│ portfolio_id (FK)    │
│ name                 │
│ is_main              │  ← 메인 플랜 표시
│ is_active            │
└────────┬─────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────┐  ┌───────────────────┐
│plan_allocations │  │ allocation_groups │
├─────────────────┤  ├───────────────────┤
│ id (PK)         │  │ id (PK)           │
│ plan_id (FK)    │  │ plan_id (FK)      │
│ asset_id (FK)   │  │ name              │
│ ticker          │  │ target_percentage │
│ target_percentage│  │ display_order     │
└─────────────────┘  └─────────┬─────────┘
                               │
                               ▼
                    ┌────────────────────────┐
                    │allocation_group_items  │
                    ├────────────────────────┤
                    │ id (PK)                │
                    │ group_id (FK)          │
                    │ asset_id (FK)          │
                    │ ticker                 │
                    │ alias                  │
                    └────────────────────────┘

┌─────────────────┐
│  asset_history  │  ← 일일 스냅샷
├─────────────────┤
│ id (PK)         │
│ portfolio_id(FK)│
│ snapshot_date   │
│ total_value     │
│ total_principal │
│ profit_rate     │
│ category_breakdown (JSONB) │
└─────────────────┘

┌─────────────────┐
│  user_settings  │
├─────────────────┤
│ id (PK)         │
│ user_id         │
│ alert_threshold │  ← 리밸런싱 알림 기준 (%)
│ calculator_tolerance │ ← 계산기 기본 허용 오차 (%)
└─────────────────┘
```

### 2.2 핵심 테이블 상세 설명

#### `portfolios` - 포트폴리오 메타데이터
```sql
-- 파일: database/schema.sql:15-25
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_currency VARCHAR(10) DEFAULT 'KRW',
    target_value DECIMAL(18,4),  -- 목표 자산 금액
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- 현재 단일 사용자 시스템으로, 기본 포트폴리오 1개 사용
- `target_value`: 목표 달성률 계산에 사용

#### `assets` - 자산 정보
```sql
-- 파일: database/schema.sql:40-60
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    ticker VARCHAR(20),           -- yfinance 조회용 (예: "005930.KS", "AAPL")
    asset_type VARCHAR(20),       -- stock, cash, bond, crypto 등
    quantity DECIMAL(18,8),       -- 8자리 소수점 (암호화폐 지원)
    average_price DECIMAL(18,4),  -- 평균 매수가
    currency VARCHAR(10) DEFAULT 'KRW',
    current_value DECIMAL(18,4),  -- 수동 입력 현재가 (현금/예금용)
    purchase_exchange_rate DECIMAL(10,4), -- USD 매수 시점 환율
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    ...
);
```

**설계 포인트:**
- `ticker` OR `current_value`: 둘 중 하나로 현재가 결정
  - ticker 있음 → yfinance에서 실시간 가격 조회
  - current_value 있음 → 수동 입력값 사용 (현금, 예금)
- `purchase_exchange_rate`: USD 자산의 매수 시점 환율 저장
  - 원금 계산: `quantity × average_price × purchase_exchange_rate`
- `quantity` 8자리 소수점: 비트코인 등 소수점 단위 거래 지원

#### `rebalance_plans` + `plan_allocations` - 리밸런싱 계획
```sql
-- 파일: database/schema.sql:100-130
CREATE TABLE rebalance_plans (
    id UUID PRIMARY KEY,
    portfolio_id UUID REFERENCES portfolios(id),
    name VARCHAR(100),        -- "공격형", "안정형" 등
    is_main BOOLEAN,          -- 메인 플랜 (하나만 TRUE)
    is_active BOOLEAN
);

CREATE TABLE plan_allocations (
    id UUID PRIMARY KEY,
    plan_id UUID REFERENCES rebalance_plans(id),
    asset_id UUID,            -- 자산 직접 참조 (우선순위 1)
    ticker VARCHAR(20),       -- 티커로 매칭 (우선순위 2)
    target_percentage DECIMAL(5,2)  -- 목표 비율 0-100
);
```

**플랜 시스템 설명:**
1. 사용자는 여러 리밸런싱 플랜을 만들 수 있음 (공격형, 안정형 등)
2. `is_main=TRUE`인 플랜이 대시보드에 표시됨
3. 각 플랜은 개별 자산별 목표 배분율을 가짐

#### `allocation_groups` - 그룹 기반 배분
```sql
-- 파일: database/migrations/002_allocation_groups.sql
CREATE TABLE allocation_groups (
    id UUID PRIMARY KEY,
    plan_id UUID REFERENCES rebalance_plans(id),
    name VARCHAR(100),        -- "미국 기술주", "국내 배당주" 등
    target_percentage DECIMAL(5,2),  -- 그룹 전체 목표 비율
    display_order INT
);

CREATE TABLE allocation_group_items (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES allocation_groups(id),
    asset_id UUID,
    ticker VARCHAR(20),
    alias VARCHAR(100)        -- "달러 현금" 등 커스텀 이름
);
```

**그룹 시스템 설명:**
- 여러 자산을 하나의 그룹으로 묶어 관리
- 예: "미국 기술주 30%" → AAPL, MSFT, GOOGL 포함
- 그룹 내 자산들은 동등하게 취급 (weight 시스템 폐기됨)

#### `asset_history` - 일일 스냅샷
```sql
-- 파일: database/schema.sql:150-165
CREATE TABLE asset_history (
    id UUID PRIMARY KEY,
    portfolio_id UUID REFERENCES portfolios(id),
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(18,4),
    total_principal DECIMAL(18,4),
    total_profit DECIMAL(18,4),
    profit_rate DECIMAL(10,4),
    category_breakdown JSONB,  -- {"국내주식": 1000000, "해외주식": 500000}
    UNIQUE(portfolio_id, snapshot_date)  -- 하루에 하나만
);
```

**스냅샷 목적:**
- 매일 23:00 (Asia/Seoul) 자동 저장
- 자산 추이 차트 데이터로 활용
- `category_breakdown`: 카테고리별 금액을 JSONB로 유연하게 저장

### 2.3 스키마 진화 (마이그레이션)

| 버전 | 파일 | 변경 내용 |
|------|------|----------|
| v1 | `schema.sql` | 초기 스키마 (portfolios, assets, target_allocations) |
| v2 | `002_allocation_groups.sql` | 그룹 기반 배분 추가 |
| v3 | `003_simplify_group_weight.sql` | 그룹 내 weight 시스템 폐기 |
| v4 | `004_deprecate_target_allocations.sql` | 카테고리 기반 배분 → 플랜 기반으로 전환 |
| v5 | `schema.sql` 업데이트 | user_settings, benchmark_history 추가 |

### 2.4 설계 결정 사항

| 결정 | 이유 |
|------|------|
| **UUID 사용** | 분산 시스템 확장성, ID 예측 불가 (보안) |
| **Decimal(18,4)** | 금융 데이터 정밀도 (float 부동소수점 오류 방지) |
| **Soft Delete** | `is_active` 플래그로 논리적 삭제 (데이터 보존) |
| **CASCADE Delete** | 포트폴리오 삭제 시 관련 데이터 자동 정리 |
| **JSONB** | 카테고리 breakdown 등 유연한 구조 저장 |
| **TIMESTAMPTZ** | 시간대 정보 포함 (글로벌 지원 대비) |

---

## 3. Backend 계층

### 3.1 디렉토리 구조 및 역할

```
backend/app/
├── main.py              # FastAPI 앱 생성, lifespan (스케줄러 시작/종료)
├── config.py            # Settings 클래스 (환경변수 로드)
├── api/v1/
│   ├── router.py        # 모든 라우터 통합 (/api/v1 prefix)
│   ├── assets.py        # 자산 CRUD 엔드포인트
│   ├── dashboard.py     # 대시보드, 히스토리, 지표 엔드포인트
│   ├── rebalance.py     # 리밸런싱 플랜/계산 엔드포인트
│   ├── settings.py      # 사용자 설정 엔드포인트
│   └── data_migration.py # 데이터 내보내기/가져오기
├── services/
│   ├── asset_service.py     # 자산 비즈니스 로직
│   ├── finance_service.py   # yfinance 연동, 가격/환율 조회
│   ├── rebalance_service.py # 플랜 관리, 리밸런싱 계산
│   └── scheduler_service.py # APScheduler, 일일 스냅샷
├── models/
│   └── schemas.py       # Pydantic Request/Response 스키마
└── db/
    └── supabase.py      # Supabase 클라이언트 싱글톤
```

### 3.2 서비스 클래스 상세 분석

#### `AssetService` (asset_service.py)

**역할:** 자산 CRUD, 포트폴리오 요약 계산, 스냅샷 저장

```python
# 파일: backend/app/services/asset_service.py

class AssetService:
    def __init__(self, db: Client):
        self.db = db  # Supabase 클라이언트

    # === CRUD 메서드 ===
    async def get_assets(self, portfolio_id: str) -> list[dict]:
        """포트폴리오의 모든 활성 자산 조회 (카테고리 JOIN)"""

    async def create_asset(self, asset: AssetCreate) -> dict:
        """새 자산 추가"""

    async def update_asset(self, asset_id: str, asset: AssetUpdate) -> dict:
        """자산 정보 수정"""

    async def soft_delete_asset(self, asset_id: str) -> None:
        """is_active = FALSE로 설정 (논리적 삭제)"""

    # === 요약 계산 ===
    def calculate_summary(
        self,
        assets: list[dict],
        exchange_rate: float
    ) -> dict:
        """
        포트폴리오 전체 요약 계산

        반환값:
        - total_value: 전체 평가금액 (KRW)
        - total_principal: 전체 원금 (KRW)
        - total_profit: 수익금
        - profit_rate: 수익률 (%)
        - allocations: 카테고리별 배분 현황
        """

    # === 히스토리 ===
    async def save_snapshot(
        self,
        portfolio_id: str,
        summary: dict
    ) -> None:
        """일일 스냅샷을 asset_history에 UPSERT"""
```

**핵심 로직 - `calculate_summary()`:**
```python
def calculate_summary(self, assets, exchange_rate):
    total_value = 0
    total_principal = 0
    category_totals = {}

    for asset in assets:
        # 현재 평가금액 계산
        if asset['currency'] == 'USD':
            # USD 자산: 현재 환율로 환산
            market_value = asset['market_value'] * exchange_rate
        else:
            market_value = asset['market_value']

        # 원금 계산
        if asset['currency'] == 'USD':
            # USD 자산: 매수 시점 환율로 환산
            principal = (asset['quantity'] * asset['average_price']
                        * asset['purchase_exchange_rate'])
        else:
            principal = asset['quantity'] * asset['average_price']

        total_value += market_value
        total_principal += principal

        # 카테고리별 집계
        category = asset['category_name'] or '기타'
        category_totals[category] = category_totals.get(category, 0) + market_value

    return {
        'total_value': total_value,
        'total_principal': total_principal,
        'total_profit': total_value - total_principal,
        'profit_rate': ((total_value - total_principal) / total_principal * 100)
                       if total_principal > 0 else 0,
        'allocations': [
            {'name': cat, 'value': val, 'percentage': val/total_value*100}
            for cat, val in category_totals.items()
        ]
    }
```

#### `FinanceService` (finance_service.py)

**역할:** yfinance 연동, 실시간 가격/환율 조회, 자산 가격 정보 enrichment

```python
# 파일: backend/app/services/finance_service.py

class FinanceService:
    _exchange_rate_cache: float = None  # 클래스 레벨 캐시
    _cache_time: datetime = None

    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=10)

    async def get_stock_price(self, ticker: str) -> dict:
        """
        단일 티커의 현재가 조회

        반환값:
        - price: 현재가
        - currency: 통화 (KRW, USD 등)
        - exchange: 거래소
        - is_valid: 유효 여부
        """

    async def get_multiple_prices(self, tickers: list[str]) -> dict[str, dict]:
        """여러 티커 동시 조회 (병렬 처리)"""

    async def get_exchange_rate(self) -> float:
        """
        USD/KRW 환율 조회 (캐싱 적용)

        캐싱 전략:
        1. 메모리 캐시 확인 (10분 유효)
        2. 캐시 없으면 yfinance 조회 (USDKRW=X)
        3. 조회 실패 시 settings.default_usd_krw_rate 사용
        """

    async def enrich_assets_with_prices(
        self,
        assets: list[dict]
    ) -> list[dict]:
        """
        자산 목록에 현재가 정보 추가 (핵심 메서드)

        처리 흐름:
        1. 티커 있는 자산 추출
        2. get_multiple_prices()로 일괄 조회
        3. 각 자산에 current_price, market_value 추가
        4. profit_loss, profit_rate 계산
        """
```

**핵심 로직 - `enrich_assets_with_prices()`:**
```python
async def enrich_assets_with_prices(self, assets: list[dict]) -> list[dict]:
    # 1. 티커 목록 추출
    tickers = [a['ticker'] for a in assets if a.get('ticker')]

    # 2. 병렬로 가격 조회
    prices = await self.get_multiple_prices(tickers)
    exchange_rate = await self.get_exchange_rate()

    enriched = []
    for asset in assets:
        ticker = asset.get('ticker')

        if ticker and ticker in prices:
            # 티커 기반 자산
            price_info = prices[ticker]
            current_price = price_info['price']
            currency = price_info['currency']
        elif asset.get('current_value'):
            # 수동 입력 자산 (현금, 예금)
            current_price = asset['current_value'] / asset['quantity']
            currency = asset['currency']
        else:
            current_price = 0
            currency = 'KRW'

        # 평가금액 계산
        market_value = current_price * asset['quantity']

        # 원금 계산
        if currency == 'USD' and asset.get('purchase_exchange_rate'):
            principal = (asset['average_price'] * asset['quantity']
                        * asset['purchase_exchange_rate'])
        else:
            principal = asset['average_price'] * asset['quantity']

        # 수익/손실 계산
        if currency == 'USD':
            profit_loss = (market_value * exchange_rate) - principal
        else:
            profit_loss = market_value - principal

        profit_rate = (profit_loss / principal * 100) if principal > 0 else 0

        enriched.append({
            **asset,
            'current_price': current_price,
            'market_value': market_value,
            'profit_loss': profit_loss,
            'profit_rate': profit_rate,
            'currency': currency
        })

    return enriched
```

**비동기 패턴 - ThreadPoolExecutor:**
```python
# yfinance는 동기 라이브러리이므로 ThreadPoolExecutor로 래핑

async def get_stock_price(self, ticker: str) -> dict:
    loop = asyncio.get_event_loop()

    def fetch_price():
        # 동기 코드 (별도 스레드에서 실행)
        stock = yf.Ticker(ticker)
        info = stock.info
        return {
            'price': info.get('currentPrice') or info.get('regularMarketPrice'),
            'currency': info.get('currency', 'KRW')
        }

    # 스레드풀에서 실행하고 결과 대기
    result = await loop.run_in_executor(self.executor, fetch_price)
    return result
```

#### `RebalanceService` (rebalance_service.py)

**역할:** 리밸런싱 플랜 관리, 배분 계산, 자산-배분항목 매칭

```python
# 파일: backend/app/services/rebalance_service.py

class RebalanceService:
    def __init__(self, db: Client):
        self.db = db

    # === 플랜 CRUD ===
    async def get_plans(self, portfolio_id: str) -> list[dict]:
        """포트폴리오의 모든 플랜 조회"""

    async def get_main_plan(self, portfolio_id: str) -> dict:
        """메인 플랜 (is_main=TRUE) 조회"""

    async def set_main_plan(self, plan_id: str) -> None:
        """특정 플랜을 메인으로 설정 (기존 메인 해제)"""

    # === 배분 저장 ===
    async def save_allocations(
        self,
        plan_id: str,
        allocations: list[dict]
    ) -> None:
        """개별 자산 배분 저장 (DELETE + INSERT)"""

    async def save_groups(
        self,
        plan_id: str,
        groups: list[dict]
    ) -> None:
        """그룹 배분 저장"""

    # === 리밸런싱 계산 ===
    async def calculate_rebalance_by_plan(
        self,
        plan_id: str,
        tolerance: float = 0
    ) -> dict:
        """
        플랜 기반 리밸런싱 계산 (핵심 메서드)

        반환값:
        - suggestions: 개별 자산별 조정 제안
        - group_suggestions: 그룹별 조정 제안
        - total_value: 전체 포트폴리오 가치
        """

    def match_item_to_asset(
        self,
        item: dict,
        assets: list[dict]
    ) -> dict | None:
        """
        배분 항목을 실제 자산과 매칭

        매칭 우선순위:
        1. asset_id (직접 참조)
        2. ticker (정확히 일치)
        3. ticker가 name에 포함 (폴백)
        4. alias (부분 일치)
        """
```

**핵심 로직 - `calculate_rebalance_by_plan()`:**
```python
async def calculate_rebalance_by_plan(
    self,
    plan_id: str,
    tolerance: float = 0
) -> dict:
    # 1. 플랜 정보 조회 (allocations + groups 포함)
    plan = await self.get_plan(plan_id)
    portfolio_id = plan['portfolio_id']

    # 2. 자산 목록 조회 + 가격 정보 추가
    assets = await self.asset_service.get_assets(portfolio_id)
    assets = await self.finance_service.enrich_assets_with_prices(assets)

    # 3. 전체 포트폴리오 가치 계산
    total_value = sum(a['market_value'] for a in assets)

    # 4. 개별 배분 계산
    suggestions = []
    for allocation in plan['allocations']:
        # 자산 매칭
        asset = self.match_item_to_asset(allocation, assets)

        if asset:
            current_value = asset['market_value']
            current_pct = (current_value / total_value * 100) if total_value > 0 else 0
        else:
            current_value = 0
            current_pct = 0

        target_pct = allocation['target_percentage']
        diff_pct = current_pct - target_pct

        # 허용 오차 내면 건너뛰기
        if abs(diff_pct) <= tolerance:
            continue

        # 조정 금액 계산
        target_value = total_value * (target_pct / 100)
        suggested_amount = target_value - current_value  # 양수=매수, 음수=매도

        suggestions.append({
            'ticker': allocation.get('ticker'),
            'asset_name': asset['name'] if asset else allocation.get('display_name'),
            'current_value': current_value,
            'current_percentage': current_pct,
            'target_percentage': target_pct,
            'diff_percentage': diff_pct,
            'suggested_amount': suggested_amount
        })

    # 5. 그룹 배분 계산 (유사한 로직)
    group_suggestions = []
    for group in plan.get('groups', []):
        # 그룹 내 모든 항목의 가치 합산
        group_value = 0
        for item in group['items']:
            asset = self.match_item_to_asset(item, assets)
            if asset:
                group_value += asset['market_value']

        # 그룹 레벨 계산
        current_pct = (group_value / total_value * 100) if total_value > 0 else 0
        target_pct = group['target_percentage']
        # ... (개별 배분과 동일한 계산)

    return {
        'suggestions': suggestions,
        'group_suggestions': group_suggestions,
        'total_value': total_value
    }
```

**매칭 로직 - `match_item_to_asset()`:**
```python
def match_item_to_asset(self, item: dict, assets: list[dict]) -> dict | None:
    """
    배분 항목 → 자산 매칭 (3단계 폴백)

    사용 시나리오:
    - asset_id: 사용자가 UI에서 자산을 직접 선택한 경우
    - ticker: "AAPL" 같은 티커로 지정한 경우
    - alias: "미국 현금" 같은 별칭으로 지정한 경우
    """

    # 1순위: asset_id 직접 매칭
    if item.get('asset_id'):
        for asset in assets:
            if asset['id'] == item['asset_id']:
                return asset

    # 2순위: ticker 정확히 일치
    if item.get('ticker'):
        ticker = item['ticker'].upper()
        for asset in assets:
            if asset.get('ticker', '').upper() == ticker:
                return asset

        # 2-1순위: ticker가 name에 포함 (폴백)
        # 예: ticker="삼성전자" → name="삼성전자 주식"
        for asset in assets:
            if ticker in asset.get('name', '').upper():
                return asset

    # 3순위: alias 부분 일치
    if item.get('alias'):
        alias = item['alias'].lower()
        for asset in assets:
            if alias in asset.get('name', '').lower():
                return asset

    return None
```

#### `SchedulerService` (scheduler_service.py)

**역할:** APScheduler로 일일 작업 스케줄링

```python
# 파일: backend/app/services/scheduler_service.py

scheduler = AsyncIOScheduler(timezone='Asia/Seoul')

async def take_daily_snapshot():
    """
    매일 23:00 실행되는 일일 스냅샷 작업

    처리 흐름:
    1. 모든 포트폴리오 ID 조회
    2. 각 포트폴리오별:
       - 자산 조회
       - 가격 정보 추가
       - 요약 계산
       - asset_history에 UPSERT
    """
    db = get_supabase_client()
    asset_service = AssetService(db)
    finance_service = FinanceService()

    portfolio_ids = await asset_service.get_all_portfolio_ids()

    for portfolio_id in portfolio_ids:
        assets = await asset_service.get_assets(portfolio_id)
        enriched = await finance_service.enrich_assets_with_prices(assets)
        exchange_rate = await finance_service.get_exchange_rate()
        summary = asset_service.calculate_summary(enriched, exchange_rate)

        await asset_service.save_snapshot(portfolio_id, summary)

def start_scheduler():
    """스케줄러 시작 (main.py lifespan에서 호출)"""
    scheduler.add_job(
        take_daily_snapshot,
        CronTrigger(hour=23, minute=0),  # 23:00
        id='daily_snapshot'
    )
    scheduler.start()

def shutdown_scheduler():
    """스케줄러 종료"""
    scheduler.shutdown()
```

### 3.3 API 엔드포인트 전체 목록

#### Assets API (`/api/v1/assets`)

| Method | Path | 설명 | 서비스 메서드 |
|--------|------|------|--------------|
| GET | `/assets` | 자산 목록 (현재가 포함) | `get_assets()` + `enrich_assets_with_prices()` |
| GET | `/assets/{id}` | 단일 자산 조회 | `get_asset()` |
| POST | `/assets` | 자산 추가 | `create_asset()` |
| PUT | `/assets/{id}` | 자산 수정 | `update_asset()` |
| DELETE | `/assets/{id}` | 자산 삭제 | `soft_delete_asset()` |
| GET | `/assets/validate-ticker/{ticker}` | 티커 유효성 검사 | `validate_ticker()` |

#### Dashboard API (`/api/v1/dashboard`)

| Method | Path | 설명 | 서비스 메서드 |
|--------|------|------|--------------|
| GET | `/dashboard/summary` | 대시보드 요약 | `get_assets()` + `calculate_summary()` |
| GET | `/dashboard/history` | 자산 추이 | `get_asset_history()` |
| GET | `/dashboard/exchange-rate` | 현재 환율 | `get_exchange_rate()` |
| GET | `/dashboard/rebalance-alerts` | 리밸런싱 알림 | 자체 계산 |
| GET | `/dashboard/goal-progress` | 목표 달성률 | `get_portfolio()` |
| GET | `/dashboard/ticker-history/{ticker}` | 티커 히스토리 | `get_ticker_history()` |
| GET | `/dashboard/market-indicators` | 시장 지표 | `get_benchmark_history()` |

#### Rebalance API (`/api/v1/rebalance`)

| Method | Path | 설명 | 서비스 메서드 |
|--------|------|------|--------------|
| GET | `/rebalance/plans` | 플랜 목록 | `get_plans()` |
| GET | `/rebalance/main-plan` | 메인 플랜 | `get_main_plan()` |
| POST | `/rebalance/plans` | 플랜 생성 | `create_plan()` |
| GET | `/rebalance/plans/{id}` | 플랜 조회 | `get_plan()` |
| PUT | `/rebalance/plans/{id}` | 플랜 수정 | `update_plan()` |
| DELETE | `/rebalance/plans/{id}` | 플랜 삭제 | `delete_plan()` |
| POST | `/rebalance/plans/{id}/set-main` | 메인 설정 | `set_main_plan()` |
| PUT | `/rebalance/plans/{id}/allocations` | 배분 저장 | `save_allocations()` |
| POST | `/rebalance/plans/{id}/calculate` | 리밸런싱 계산 | `calculate_rebalance_by_plan()` |
| GET | `/rebalance/plans/{id}/groups` | 그룹 조회 | `get_groups()` |
| PUT | `/rebalance/plans/{id}/groups` | 그룹 저장 | `save_groups()` |

#### Settings API (`/api/v1/settings`)

| Method | Path | 설명 | 서비스 메서드 |
|--------|------|------|--------------|
| GET | `/settings` | 설정 조회 | DB 직접 조회 |
| PUT | `/settings` | 설정 수정 | DB 직접 수정 |

### 3.4 환율 처리 상세

**USD 자산의 가치 계산:**

```python
# 1. 현재 평가금액 (실시간 환율 적용)
market_value_krw = quantity * current_price_usd * current_exchange_rate

# 2. 원금 (매수 시점 환율 적용)
principal_krw = quantity * average_price_usd * purchase_exchange_rate

# 3. 수익/손실
profit_loss = market_value_krw - principal_krw
```

**환율 캐싱 전략:**
```python
class FinanceService:
    _exchange_rate_cache: float = None
    _cache_time: datetime = None
    CACHE_DURATION = timedelta(minutes=10)

    async def get_exchange_rate(self) -> float:
        # 캐시 유효 확인
        if (self._exchange_rate_cache and self._cache_time and
            datetime.now() - self._cache_time < self.CACHE_DURATION):
            return self._exchange_rate_cache

        try:
            # yfinance에서 조회
            rate = await self._fetch_from_yfinance("USDKRW=X")
            self._exchange_rate_cache = rate
            self._cache_time = datetime.now()
            return rate
        except:
            # 실패 시 설정값 사용
            return settings.default_usd_krw_rate  # 기본 1350.0
```

---

## 4. Frontend 계층

### 4.1 디렉토리 구조 및 역할

```
frontend/src/
├── main.tsx             # React 진입점, QueryClientProvider
├── App.tsx              # React Router 설정
├── index.css            # Tailwind 글로벌 스타일
│
├── pages/               # 페이지 컴포넌트 (라우트별)
│   ├── DashboardPage.tsx    # / - 대시보드
│   ├── AssetsPage.tsx       # /assets - 자산 관리
│   ├── RebalancePage.tsx    # /rebalance - 리밸런싱 계산기
│   ├── RebalancePlanPage.tsx # /rebalance/plans - 플랜 관리
│   ├── SettingsPage.tsx     # /settings - 설정
│   └── GuidePage.tsx        # /guide - 도움말
│
├── components/
│   ├── ui/              # shadcn/ui 기본 컴포넌트
│   │   ├── button.tsx, card.tsx, dialog.tsx, ...
│   │
│   ├── layout/          # 레이아웃 컴포넌트
│   │   ├── Layout.tsx       # 전체 레이아웃 (Sidebar + Content)
│   │   ├── Header.tsx       # 상단 헤더
│   │   └── Sidebar.tsx      # 사이드 네비게이션
│   │
│   ├── dashboard/       # 대시보드 전용 컴포넌트
│   │   ├── SummaryCards.tsx     # 요약 카드 4개
│   │   ├── PortfolioDonut.tsx   # 포트폴리오 도넛 차트
│   │   ├── AssetTrendChart.tsx  # 자산 추이 차트
│   │   ├── RebalanceAlert.tsx   # 리밸런싱 알림 배너
│   │   ├── GoalProgress.tsx     # 목표 달성률
│   │   └── MarketIndicators.tsx # 시장 지표
│   │
│   ├── assets/          # 자산 관리 컴포넌트
│   │   ├── AssetList.tsx    # 자산 목록 테이블
│   │   └── AssetForm.tsx    # 자산 추가/수정 폼
│   │
│   └── rebalance/       # 리밸런싱 컴포넌트
│       ├── AllocationEditor.tsx  # 배분 편집기
│       ├── AddAllocationModal.tsx
│       ├── AddGroupModal.tsx
│       └── RealTimePieChart.tsx
│
├── hooks/               # React Query 커스텀 훅
│   ├── useAssets.ts         # 자산 CRUD 훅
│   ├── useDashboard.ts      # 대시보드 데이터 훅
│   ├── useRebalance.ts      # 리밸런싱 훅
│   └── useSettings.ts       # 설정 훅
│
├── store/               # Zustand 전역 상태
│   └── useStore.ts          # 다크모드, 프라이버시모드, 사이드바
│
├── lib/
│   ├── api.ts           # Axios 클라이언트 + API 함수
│   ├── utils.ts         # 유틸리티 (포맷팅, 색상 등)
│   └── version.ts       # 앱 버전
│
└── types/
    └── index.ts         # TypeScript 인터페이스 정의
```

### 4.2 상태 관리 아키텍처

#### Zustand (클라이언트 UI 상태)

```typescript
// 파일: frontend/src/store/useStore.ts

interface AppState {
  // 상태
  currentPortfolioId: string | null;
  isSidebarOpen: boolean;
  isDarkMode: boolean;
  isPrivacyMode: boolean;

  // 액션
  setCurrentPortfolioId: (id: string) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  togglePrivacyMode: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentPortfolioId: null,
      isSidebarOpen: true,
      isDarkMode: false,
      isPrivacyMode: false,

      toggleDarkMode: () => set((state) => {
        const newMode = !state.isDarkMode;
        // DOM에 dark 클래스 토글
        document.documentElement.classList.toggle('dark', newMode);
        return { isDarkMode: newMode };
      }),

      togglePrivacyMode: () => set((state) => ({
        isPrivacyMode: !state.isPrivacyMode
      })),
      // ...
    }),
    {
      name: 'meowney-storage',  // localStorage 키
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        isPrivacyMode: state.isPrivacyMode
      })
    }
  )
);
```

**사용 예:**
```tsx
function SomeComponent() {
  const { isDarkMode, toggleDarkMode } = useStore();

  return (
    <button onClick={toggleDarkMode}>
      {isDarkMode ? '라이트 모드' : '다크 모드'}
    </button>
  );
}
```

#### React Query (서버 상태)

```typescript
// 파일: frontend/src/hooks/useAssets.ts

// Query Keys 정의 (캐시 키)
export const assetKeys = {
  all: ['assets'] as const,
  lists: () => [...assetKeys.all, 'list'] as const,
  detail: (id: string) => [...assetKeys.all, 'detail', id] as const,
};

// 자산 목록 조회 훅
export function useAssets() {
  return useQuery({
    queryKey: assetKeys.lists(),
    queryFn: () => assetsApi.getAll(),
    staleTime: 1000 * 60,  // 1분간 fresh 유지
  });
}

// 자산 생성 뮤테이션
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: AssetCreate) => assetsApi.create(asset),
    onSuccess: () => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

**캐시 무효화 전략:**
```
자산 생성/수정/삭제 시:
  → assets 캐시 무효화
  → dashboard 캐시 무효화

플랜 수정 시:
  → rebalance-plans 캐시 무효화
  → dashboard 캐시 무효화 (도넛차트 영향)

설정 수정 시:
  → settings 캐시 무효화
```

### 4.3 핵심 훅 상세 분석

#### `useAssets()` - 자산 데이터 관리

```typescript
// 파일: frontend/src/hooks/useAssets.ts

export function useAssets() {
  return useQuery({
    queryKey: assetKeys.lists(),
    queryFn: async () => {
      // GET /api/v1/assets 호출
      const response = await assetsApi.getAll();
      // 반환: { assets: Asset[], summary: AssetsSummary }
      return response;
    },
    staleTime: 1000 * 60,  // 1분
  });
}

// 사용 예
function AssetsPage() {
  const { data, isLoading, error } = useAssets();

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      <SummaryCards summary={data.summary} />
      <AssetList assets={data.assets} />
    </div>
  );
}
```

#### `useDashboardSummary()` - 대시보드 데이터

```typescript
// 파일: frontend/src/hooks/useDashboard.ts

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.getSummary(),
    staleTime: 1000 * 60,      // 1분 fresh
    refetchInterval: 5 * 60 * 1000,  // 5분마다 자동 갱신
  });
}

// 반환 타입
interface DashboardSummary {
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number;
  asset_count: number;
  allocations: CategoryAllocation[];  // 카테고리별 배분
  main_plan_info?: {                  // 메인 플랜 정보
    allocations: PlanAllocation[];
    groups: AllocationGroup[];
  };
}
```

#### `useCalculateRebalance()` - 리밸런싱 계산

```typescript
// 파일: frontend/src/hooks/useRebalance.ts

export function useCalculateRebalance() {
  return useMutation({
    mutationFn: ({ planId, tolerance }: { planId: string; tolerance: number }) =>
      rebalanceApi.calculate(planId, tolerance),
  });
}

// 사용 예
function RebalancePage() {
  const calculateMutation = useCalculateRebalance();
  const [tolerance, setTolerance] = useState(0);

  const handleCalculate = async (planId: string) => {
    const result = await calculateMutation.mutateAsync({ planId, tolerance });
    // result: {
    //   suggestions: AssetRebalanceSuggestion[],
    //   group_suggestions: GroupRebalanceSuggestion[],
    //   total_value: number
    // }
  };
}
```

### 4.4 주요 컴포넌트 동작 원리

#### `PortfolioDonut` - 포트폴리오 도넛 차트

```tsx
// 파일: frontend/src/components/dashboard/PortfolioDonut.tsx

function PortfolioDonut({ summary }: { summary: DashboardSummary }) {
  const { data: mainPlan } = useMainPlan();
  const { data: assetsData } = useAssets();

  // 플랜 기반 데이터 생성
  const chartData = useMemo(() => {
    if (!mainPlan || !assetsData) {
      // 폴백: 카테고리 기반
      return summary.allocations.map(cat => ({
        name: cat.name,
        value: cat.value,
        color: cat.color
      }));
    }

    // 플랜 기반 차트 데이터 생성
    const data: ChartItem[] = [];
    const matchedAssetIds = new Set<string>();

    // 1. 개별 배분 처리
    for (const allocation of mainPlan.allocations) {
      const asset = matchItemToAsset(allocation, assetsData.assets);
      if (asset) {
        matchedAssetIds.add(asset.id);
        data.push({
          name: allocation.display_name || asset.name,
          value: asset.market_value,
          color: getColorForIndex(data.length)
        });
      }
    }

    // 2. 그룹 배분 처리
    for (const group of mainPlan.groups) {
      let groupValue = 0;
      for (const item of group.items) {
        const asset = matchItemToAsset(item, assetsData.assets);
        if (asset) {
          matchedAssetIds.add(asset.id);
          groupValue += asset.market_value;
        }
      }
      data.push({
        name: group.name,
        value: groupValue,
        color: getColorForIndex(data.length)
      });
    }

    // 3. 미배정 자산 (주황색 경고)
    const unassignedValue = assetsData.assets
      .filter(a => !matchedAssetIds.has(a.id))
      .reduce((sum, a) => sum + a.market_value, 0);

    if (unassignedValue > 0) {
      data.push({
        name: '미배정',
        value: unassignedValue,
        color: '#f97316'  // 주황색 (경고)
      });
    }

    return data;
  }, [mainPlan, assetsData, summary]);

  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={chartData} dataKey="value" ... />
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// 스마트 매칭 함수 (백엔드 로직과 동일)
function matchItemToAsset(item: AllocationItem, assets: Asset[]): Asset | null {
  // 1순위: asset_id
  if (item.asset_id) {
    return assets.find(a => a.id === item.asset_id) || null;
  }

  // 2순위: ticker
  if (item.ticker) {
    const byTicker = assets.find(a =>
      a.ticker?.toUpperCase() === item.ticker.toUpperCase()
    );
    if (byTicker) return byTicker;

    // 폴백: name에 ticker 포함
    const byName = assets.find(a =>
      a.name.toUpperCase().includes(item.ticker.toUpperCase())
    );
    if (byName) return byName;
  }

  // 3순위: alias
  if (item.alias) {
    return assets.find(a =>
      a.name.toLowerCase().includes(item.alias.toLowerCase())
    ) || null;
  }

  return null;
}
```

#### `AssetTrendChart` - 자산 추이 차트

```tsx
// 파일: frontend/src/components/dashboard/AssetTrendChart.tsx

function AssetTrendChart() {
  const [period, setPeriod] = useState<Period>('1M');
  const { data: history } = useAssetHistoryByPeriod(period);
  const { isPrivacyMode } = useStore();

  const chartData = useMemo(() => {
    if (!history) return [];

    return history.map(item => ({
      date: formatDate(item.snapshot_date),
      totalValue: item.total_value,
      totalPrincipal: item.total_principal,
      // 수익률 색상 결정
      profitColor: item.profit_rate >= 0 ? '#ef4444' : '#3b82f6'  // 빨강/파랑
    }));
  }, [history]);

  return (
    <Card>
      <PeriodSelector value={period} onChange={setPeriod} />

      <ResponsiveContainer>
        <ComposedChart data={chartData}>
          {/* 원금 영역 (회색) */}
          <Area
            dataKey="totalPrincipal"
            fill="#9ca3af"
            stroke="#9ca3af"
          />

          {/* 평가금액 선 */}
          <Line
            dataKey="totalValue"
            stroke="#3b82f6"
          />

          <XAxis dataKey="date" />
          <YAxis
            tickFormatter={(v) =>
              isPrivacyMode ? '***' : formatKRW(v)
            }
          />
          <Tooltip />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

### 4.5 API 클라이언트 구조

```typescript
// 파일: frontend/src/lib/api.ts

import axios from 'axios';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 30000,
});

// 응답 인터셉터 (에러 처리)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail
      || '냥? 서버와 통신 중 문제가 발생했다옹! 🙀';
    return Promise.reject(new Error(message));
  }
);

// API 함수들 (도메인별 그룹화)
export const assetsApi = {
  getAll: async (): Promise<AssetsListResponse> => {
    const { data } = await api.get('/assets');
    return data;
  },

  create: async (asset: AssetCreate): Promise<Asset> => {
    const { data } = await api.post('/assets', asset);
    return data;
  },

  update: async (id: string, asset: AssetUpdate): Promise<Asset> => {
    const { data } = await api.put(`/assets/${id}`, asset);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/assets/${id}`);
  },

  validateTicker: async (ticker: string): Promise<TickerValidation> => {
    const { data } = await api.get(`/assets/validate-ticker/${ticker}`);
    return data;
  },
};

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const { data } = await api.get('/dashboard/summary');
    return data;
  },

  getHistory: async (days?: number): Promise<AssetHistory[]> => {
    const { data } = await api.get('/dashboard/history', {
      params: { days }
    });
    return data;
  },

  getExchangeRate: async (): Promise<ExchangeRateResponse> => {
    const { data } = await api.get('/dashboard/exchange-rate');
    return data;
  },
  // ...
};

export const rebalanceApi = {
  calculate: async (
    planId: string,
    tolerance: number
  ): Promise<AssetRebalanceResponse> => {
    const { data } = await api.post(
      `/rebalance/plans/${planId}/calculate`,
      { tolerance }
    );
    return data;
  },
  // ...
};
```

### 4.6 주요 타입 정의

```typescript
// 파일: frontend/src/types/index.ts

// 자산
export interface Asset {
  id: string;
  portfolio_id: string;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  name: string;
  ticker: string | null;
  asset_type: string;
  quantity: number;
  average_price: number;
  currency: string;
  current_value: number | null;
  purchase_exchange_rate: number | null;
  notes: string | null;
  is_active: boolean;
  // 계산된 필드 (백엔드에서 추가)
  current_price: number;
  market_value: number;
  profit_loss: number;
  profit_rate: number;
}

// 대시보드 요약
export interface DashboardSummary {
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number;
  asset_count: number;
  allocations: CategoryAllocation[];
  main_plan_info?: MainPlanInfo;
}

// 리밸런싱 제안
export interface AssetRebalanceSuggestion {
  ticker: string | null;
  asset_name: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  diff_percentage: number;
  suggested_amount: number;  // 양수=매수, 음수=매도
  suggested_quantity?: number;
}

// 그룹 리밸런싱 제안
export interface GroupRebalanceSuggestion {
  group_name: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  diff_percentage: number;
  suggested_amount: number;
}

// 사용자 설정
export interface UserSettings {
  alert_threshold: number;      // 리밸런싱 알림 기준 (%)
  calculator_tolerance: number; // 계산기 기본 허용 오차 (%)
}
```

---

## 5. End-to-End 데이터 흐름

### 5.1 자산 추가 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AssetForm.tsx                                                  │
│  ┌─────────────────────────────────────────┐                   │
│  │ 1. 사용자가 폼 입력                      │                   │
│  │    - 자산명, 티커, 수량, 평균가, 통화    │                   │
│  │                                          │                   │
│  │ 2. handleSubmit()                        │                   │
│  │    └─ useCreateAsset().mutateAsync()     │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  lib/api.ts                                                     │
│  ┌─────────────────────────────────────────┐                   │
│  │ 3. assetsApi.create(assetData)          │                   │
│  │    └─ POST /api/v1/assets               │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP Request
┌─────────────────────────┼───────────────────────────────────────┐
│ Backend                 ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  api/v1/assets.py                                               │
│  ┌─────────────────────────────────────────┐                   │
│  │ 4. @router.post("/assets")              │                   │
│  │    async def create_asset(              │                   │
│  │        asset: AssetCreate,              │                   │
│  │        db: SupabaseDep                  │                   │
│  │    ):                                   │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  services/asset_service.py                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │ 5. AssetService.create_asset()          │                   │
│  │    - 데이터 검증                         │                   │
│  │    - Supabase INSERT 실행               │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ DB Insert
┌─────────────────────────┼───────────────────────────────────────┐
│ Database                ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│  INSERT INTO assets (...)                                       │
│  RETURNING *                                                    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼ Response
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (캐시 무효화)                                           │
├─────────────────────────────────────────────────────────────────┤
│  useCreateAsset.onSuccess()                                     │
│  ┌─────────────────────────────────────────┐                   │
│  │ 6. queryClient.invalidateQueries()      │                   │
│  │    - assetKeys.lists() → 자산 목록 갱신  │                   │
│  │    - ['dashboard'] → 대시보드 갱신       │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 대시보드 로딩 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DashboardPage.tsx                                              │
│  ┌─────────────────────────────────────────┐                   │
│  │ 1. 컴포넌트 마운트                       │                   │
│  │    └─ useDashboardSummary() 호출        │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  hooks/useDashboard.ts                                          │
│  ┌─────────────────────────────────────────┐                   │
│  │ 2. useQuery 실행                        │                   │
│  │    └─ dashboardApi.getSummary()         │                   │
│  │    └─ GET /api/v1/dashboard/summary     │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP Request
┌─────────────────────────┼───────────────────────────────────────┐
│ Backend                 ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  api/v1/dashboard.py                                            │
│  ┌─────────────────────────────────────────┐                   │
│  │ 3. @router.get("/dashboard/summary")    │                   │
│  │    async def get_summary():             │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│             ┌───────────┴───────────┐                          │
│             ▼                       ▼                          │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │ AssetService     │    │ FinanceService   │                  │
│  │ .get_assets()    │    │                  │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                            │
│           ▼                       │                            │
│  ┌──────────────────┐             │                            │
│  │ 4. DB 조회       │             │                            │
│  │ SELECT * FROM    │             │                            │
│  │ assets WHERE ... │             │                            │
│  └────────┬─────────┘             │                            │
│           │                       │                            │
│           └───────────┬───────────┘                            │
│                       ▼                                        │
│  ┌─────────────────────────────────────────┐                   │
│  │ 5. enrich_assets_with_prices()          │                   │
│  │    ┌─────────────────────────────────┐  │                   │
│  │    │ 5a. 티커 목록 추출               │  │                   │
│  │    │     ["005930.KS", "AAPL", ...]  │  │                   │
│  │    └─────────────────────────────────┘  │                   │
│  │                    │                    │                   │
│  │                    ▼                    │                   │
│  │    ┌─────────────────────────────────┐  │                   │
│  │    │ 5b. get_multiple_prices()       │  │                   │
│  │    │     (ThreadPoolExecutor)        │  │                   │
│  │    │     → yfinance 병렬 조회        │  │                   │
│  │    └─────────────────────────────────┘  │                   │
│  │                    │                    │                   │
│  │                    ▼                    │                   │
│  │    ┌─────────────────────────────────┐  │                   │
│  │    │ 5c. get_exchange_rate()         │  │                   │
│  │    │     → 캐시 확인 or yfinance     │  │                   │
│  │    └─────────────────────────────────┘  │                   │
│  │                    │                    │                   │
│  │                    ▼                    │                   │
│  │    ┌─────────────────────────────────┐  │                   │
│  │    │ 5d. 각 자산에 계산 필드 추가     │  │                   │
│  │    │     - current_price             │  │                   │
│  │    │     - market_value              │  │                   │
│  │    │     - profit_loss               │  │                   │
│  │    │     - profit_rate               │  │                   │
│  │    └─────────────────────────────────┘  │                   │
│  └─────────────────────────────────────────┘                   │
│                       │                                        │
│                       ▼                                        │
│  ┌─────────────────────────────────────────┐                   │
│  │ 6. calculate_summary()                  │                   │
│  │    - total_value 합산                   │                   │
│  │    - total_principal 합산               │                   │
│  │    - profit_rate 계산                   │                   │
│  │    - 카테고리별 allocations 생성        │                   │
│  └─────────────────────────────────────────┘                   │
│                       │                                        │
│                       ▼                                        │
│  ┌─────────────────────────────────────────┐                   │
│  │ 7. 메인 플랜 정보 조회 (optional)        │                   │
│  │    RebalanceService.get_main_plan()     │                   │
│  └─────────────────────────────────────────┘                   │
│                       │                                        │
└───────────────────────┼─────────────────────────────────────────┘
                        │ JSON Response
┌───────────────────────┼─────────────────────────────────────────┐
│ Frontend              ▼                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DashboardPage.tsx                                              │
│  ┌─────────────────────────────────────────┐                   │
│  │ 8. 데이터 렌더링                         │                   │
│  │    ├─ SummaryCards (total_value 등)     │                   │
│  │    ├─ PortfolioDonut (allocations)      │                   │
│  │    ├─ AssetTrendChart (history 별도)    │                   │
│  │    └─ RebalanceAlert (threshold 체크)   │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 리밸런싱 계산 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RebalancePage.tsx                                              │
│  ┌─────────────────────────────────────────┐                   │
│  │ 1. 사용자가 플랜 선택 + 허용 오차 입력   │                   │
│  │    └─ handleCalculate() 클릭            │                   │
│  │                                          │                   │
│  │ 2. useCalculateRebalance().mutateAsync() │                   │
│  │    └─ POST /api/v1/rebalance/plans/{id}/calculate          │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP Request { tolerance: 3.0 }
┌─────────────────────────┼───────────────────────────────────────┐
│ Backend                 ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  services/rebalance_service.py                                  │
│  ┌─────────────────────────────────────────┐                   │
│  │ 3. calculate_rebalance_by_plan()        │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│           ┌─────────────┼─────────────┐                        │
│           ▼             ▼             ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ 4a. 플랜 조회 │ │ 4b. 자산 조회 │ │ 4c. 가격 조회 │           │
│  │ get_plan()   │ │ get_assets() │ │ enrich...()  │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│           │             │             │                        │
│           └─────────────┴─────────────┘                        │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ 5. 전체 포트폴리오 가치 계산             │                   │
│  │    total_value = sum(asset.market_value)│                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ 6. 개별 배분(allocations) 계산          │                   │
│  │                                          │                   │
│  │    for allocation in plan.allocations:  │                   │
│  │      ┌────────────────────────────────┐ │                   │
│  │      │ 6a. match_item_to_asset()      │ │                   │
│  │      │     1순위: asset_id            │ │                   │
│  │      │     2순위: ticker              │ │                   │
│  │      │     3순위: alias               │ │                   │
│  │      └────────────────────────────────┘ │                   │
│  │                                          │                   │
│  │      ┌────────────────────────────────┐ │                   │
│  │      │ 6b. 비율 계산                   │ │                   │
│  │      │  current% = value/total * 100  │ │                   │
│  │      │  target% = allocation.target   │ │                   │
│  │      │  diff% = current% - target%    │ │                   │
│  │      └────────────────────────────────┘ │                   │
│  │                                          │                   │
│  │      ┌────────────────────────────────┐ │                   │
│  │      │ 6c. 허용 오차 체크              │ │                   │
│  │      │  if abs(diff%) > tolerance:    │ │                   │
│  │      │    suggested_amount 계산        │ │                   │
│  │      └────────────────────────────────┘ │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ 7. 그룹 배분(groups) 계산               │                   │
│  │                                          │                   │
│  │    for group in plan.groups:            │                   │
│  │      group_value = 0                    │                   │
│  │      for item in group.items:           │                   │
│  │        asset = match_item_to_asset()    │                   │
│  │        group_value += asset.market_value│                   │
│  │                                          │                   │
│  │      current% = group_value/total * 100 │                   │
│  │      target% = group.target_percentage  │                   │
│  │      diff% = current% - target%         │                   │
│  │      suggested_amount = ...             │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ JSON Response
┌─────────────────────────┼───────────────────────────────────────┐
│ Frontend                ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RebalancePage.tsx                                              │
│  ┌─────────────────────────────────────────┐                   │
│  │ 8. 결과 렌더링                           │                   │
│  │                                          │                   │
│  │    suggestions.map(s => (               │                   │
│  │      <SuggestionRow                     │                   │
│  │        name={s.asset_name}              │                   │
│  │        current={s.current_percentage}   │                   │
│  │        target={s.target_percentage}     │                   │
│  │        amount={s.suggested_amount}      │                   │
│  │        // 양수면 "매수", 음수면 "매도"   │                   │
│  │      />                                 │                   │
│  │    ))                                   │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 일일 스냅샷 흐름 (23:00 자동 실행)

```
┌─────────────────────────────────────────────────────────────────┐
│ Scheduler (APScheduler)                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  main.py (lifespan)                                             │
│  ┌─────────────────────────────────────────┐                   │
│  │ 앱 시작 시:                              │                   │
│  │   scheduler.add_job(                    │                   │
│  │     take_daily_snapshot,                │                   │
│  │     CronTrigger(hour=23, minute=0)      │                   │
│  │   )                                     │                   │
│  │   scheduler.start()                     │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼ 매일 23:00 트리거                     │
│  services/scheduler_service.py                                  │
│  ┌─────────────────────────────────────────┐                   │
│  │ take_daily_snapshot()                   │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ 1. 모든 포트폴리오 ID 조회               │                   │
│  │    get_all_portfolio_ids()              │                   │
│  └─────────────────────────────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ 2. 각 포트폴리오 순회                    │                   │
│  │    for portfolio_id in portfolio_ids:   │                   │
│  │                                          │                   │
│  │    ┌────────────────────────────────┐   │                   │
│  │    │ 2a. 자산 조회                   │   │                   │
│  │    │     get_assets(portfolio_id)   │   │                   │
│  │    └────────────────────────────────┘   │                   │
│  │                 │                        │                   │
│  │                 ▼                        │                   │
│  │    ┌────────────────────────────────┐   │                   │
│  │    │ 2b. 가격 정보 추가              │   │                   │
│  │    │     enrich_assets_with_prices()│   │                   │
│  │    │     (yfinance 조회)             │   │                   │
│  │    └────────────────────────────────┘   │                   │
│  │                 │                        │                   │
│  │                 ▼                        │                   │
│  │    ┌────────────────────────────────┐   │                   │
│  │    │ 2c. 요약 계산                   │   │                   │
│  │    │     calculate_summary()        │   │                   │
│  │    │     → total_value              │   │                   │
│  │    │     → total_principal          │   │                   │
│  │    │     → profit_rate              │   │                   │
│  │    │     → category_breakdown       │   │                   │
│  │    └────────────────────────────────┘   │                   │
│  │                 │                        │                   │
│  │                 ▼                        │                   │
│  │    ┌────────────────────────────────┐   │                   │
│  │    │ 2d. 스냅샷 저장 (UPSERT)        │   │                   │
│  │    │     save_snapshot()            │   │                   │
│  │    └────────────────────────────────┘   │                   │
│  │                                          │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Database                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INSERT INTO asset_history (                                    │
│    portfolio_id, snapshot_date, total_value,                    │
│    total_principal, total_profit, profit_rate,                  │
│    category_breakdown                                           │
│  ) VALUES (...)                                                 │
│  ON CONFLICT (portfolio_id, snapshot_date)                      │
│  DO UPDATE SET                                                  │
│    total_value = EXCLUDED.total_value,                          │
│    ...                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 학습 Q&A

### Q1: "자산의 현재가는 어떻게 가져오나요?"

**답변:**
1. **티커 기반 자산**: yfinance 라이브러리로 실시간 조회
2. **수동 입력 자산**: `assets.current_value` 필드 사용

**코드 위치:**
- [backend/app/services/finance_service.py](backend/app/services/finance_service.py) - `get_stock_price()`, `enrich_assets_with_prices()`

**흐름:**
```python
# finance_service.py
async def enrich_assets_with_prices(self, assets):
    tickers = [a['ticker'] for a in assets if a.get('ticker')]
    prices = await self.get_multiple_prices(tickers)  # yfinance 병렬 조회

    for asset in assets:
        if asset.get('ticker'):
            asset['current_price'] = prices[asset['ticker']]['price']
        elif asset.get('current_value'):
            # 수동 입력 (현금, 예금)
            asset['current_price'] = asset['current_value'] / asset['quantity']
```

---

### Q2: "환율 변환은 어떻게 처리하나요?"

**답변:**
- **현재 평가금액**: 실시간 환율 적용
- **원금**: 매수 시점 환율(`purchase_exchange_rate`) 적용

**코드 위치:**
- [backend/app/services/finance_service.py](backend/app/services/finance_service.py) - `get_exchange_rate()`
- [backend/app/services/asset_service.py](backend/app/services/asset_service.py) - `calculate_summary()`

**예시:**
```python
# USD 자산 평가
if asset['currency'] == 'USD':
    # 현재 가치 (실시간 환율)
    market_value_krw = market_value_usd * current_exchange_rate

    # 원금 (매수 시점 환율)
    principal_krw = quantity * average_price * purchase_exchange_rate

    # 수익/손실
    profit_loss = market_value_krw - principal_krw
```

---

### Q3: "리밸런싱 계산 로직은 어디에 있나요?"

**답변:**
`RebalanceService.calculate_rebalance_by_plan()` 메서드

**코드 위치:**
- [backend/app/services/rebalance_service.py](backend/app/services/rebalance_service.py)

**핵심 로직:**
```python
# 개별 배분 계산
for allocation in plan['allocations']:
    asset = self.match_item_to_asset(allocation, assets)
    current_pct = asset['market_value'] / total_value * 100
    target_pct = allocation['target_percentage']
    diff_pct = current_pct - target_pct

    if abs(diff_pct) > tolerance:
        suggested_amount = total_value * (target_pct / 100) - asset['market_value']
        # 양수 = 매수 필요, 음수 = 매도 필요
```

---

### Q4: "일일 스냅샷은 언제, 어떻게 저장되나요?"

**답변:**
- **시간**: 매일 23:00 (Asia/Seoul)
- **방법**: APScheduler의 CronTrigger로 자동 실행

**코드 위치:**
- [backend/app/services/scheduler_service.py](backend/app/services/scheduler_service.py)
- [backend/app/main.py](backend/app/main.py) - lifespan에서 스케줄러 시작

**스케줄러 설정:**
```python
# scheduler_service.py
scheduler.add_job(
    take_daily_snapshot,
    CronTrigger(hour=23, minute=0, timezone='Asia/Seoul'),
    id='daily_snapshot'
)
```

---

### Q5: "프론트엔드 캐시는 어떻게 관리되나요?"

**답변:**
React Query의 캐시 무효화(invalidation) 패턴 사용

**코드 위치:**
- [frontend/src/hooks/useAssets.ts](frontend/src/hooks/useAssets.ts)
- [frontend/src/hooks/useDashboard.ts](frontend/src/hooks/useDashboard.ts)

**캐시 전략:**
```typescript
// 자산 생성 후 캐시 무효화
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset) => assetsApi.create(asset),
    onSuccess: () => {
      // 관련 캐시 무효화 → 자동 재조회
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

---

### Q6: "자산과 배분 항목은 어떻게 매칭되나요?"

**답변:**
3단계 폴백 매칭 로직 사용

**코드 위치:**
- [backend/app/services/rebalance_service.py](backend/app/services/rebalance_service.py) - `match_item_to_asset()`
- [frontend/src/components/dashboard/PortfolioDonut.tsx](frontend/src/components/dashboard/PortfolioDonut.tsx) - `matchItemToAsset()`

**매칭 우선순위:**
```python
def match_item_to_asset(item, assets):
    # 1순위: asset_id (UI에서 직접 선택)
    if item.get('asset_id'):
        return find_by_id(assets, item['asset_id'])

    # 2순위: ticker (정확히 일치)
    if item.get('ticker'):
        asset = find_by_ticker(assets, item['ticker'])
        if asset:
            return asset
        # 폴백: name에 ticker 포함
        return find_by_name_contains(assets, item['ticker'])

    # 3순위: alias (부분 일치)
    if item.get('alias'):
        return find_by_name_contains(assets, item['alias'])

    return None
```

---

## 부록: 파일 경로 빠른 참조

| 기능 | 파일 경로 |
|------|----------|
| DB 스키마 | `database/schema.sql` |
| 마이그레이션 | `database/migrations/` |
| API 라우터 | `backend/app/api/v1/` |
| 자산 서비스 | `backend/app/services/asset_service.py` |
| 금융 서비스 | `backend/app/services/finance_service.py` |
| 리밸런싱 서비스 | `backend/app/services/rebalance_service.py` |
| 스케줄러 | `backend/app/services/scheduler_service.py` |
| Pydantic 스키마 | `backend/app/models/schemas.py` |
| React 페이지 | `frontend/src/pages/` |
| React Query 훅 | `frontend/src/hooks/` |
| Zustand 스토어 | `frontend/src/store/useStore.ts` |
| API 클라이언트 | `frontend/src/lib/api.ts` |
| 타입 정의 | `frontend/src/types/index.ts` |
