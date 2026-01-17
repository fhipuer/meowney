# Meowney 기능 스펙 문서

> 최종 업데이트: 2026-01-18 (v0.5.0 Docker 배포 지원)

## 1. 프로젝트 개요

**Meowney (먀우니)** - 고양이 집사를 위한 자산 배분 관리 대시보드

**버전**: 0.5.0

### 핵심 기능
- 개인 자산 포트폴리오 관리
- 일별 자산 추이 추적 (매일 23:00 자동 스냅샷)
- 리밸런싱 플랜 기반 계산기
- 실시간 시세 조회 (yfinance 연동)

### 기술 스택
| 영역 | 기술 |
|------|------|
| Backend | FastAPI + Pydantic v2 + uvicorn |
| Frontend | React + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| 상태관리 | TanStack Query (API) + Zustand (전역) |
| 차트 | Recharts |
| 시세 | yfinance |
| 스케줄러 | APScheduler |
| 배포 | Docker & Docker Compose, Synology NAS |

---

## 2. 구현된 기능 목록

### 2.1 대시보드 (`/`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 총 자산 요약 | ✅ | 총자산, 투자원금, 총손익, 수익률 카드 |
| 시장 현황 | ✅ | KOSPI, S&P500, NASDAQ, VIX, USD/KRW 실시간 표시 |
| 포트폴리오 배분 차트 | ✅ | 도넛 차트 (메인 플랜 기반 그룹/개별 배분) |
| 자산 추이 차트 | ✅ | 라인 차트 (일별 히스토리) |
| 리밸런싱 알림 | ✅ | 목표 대비 편차 큰 항목 알림 배너 |
| USD/KRW 환율 표시 | ✅ | 헤더에 실시간 환율 표시 |

### 2.2 자산 목록 (`/assets`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 자산 목록 조회 | ✅ | 테이블 형태, 현재가/수익률 표시 |
| 자산 추가 | ✅ | 티커, 수량, 평균매입가, 카테고리 입력 |
| 자산 수정 | ✅ | 기존 자산 정보 수정 |
| 자산 삭제 | ✅ | 자산 삭제 (확인 다이얼로그) |
| 수동 가격 입력 | ✅ | 티커 없는 자산 (현금, 부동산 등) 수동 가격 설정 |
| 카테고리 분류 | ✅ | 국내주식, 해외주식, 채권, 현금 등 |
| 손익 색상 | ✅ | 한국식 (빨간색=수익, 파란색=손실) |

### 2.3 리밸런싱 (`/rebalance`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 리밸런싱 계산 | ✅ | 메인 플랜 기준 매수/매도 수량 계산 |
| 추가 투자금 입력 | ✅ | 추가 투자 시 배분 계산 |
| 현재 vs 목표 비교 | ✅ | 현재 비율과 목표 비율 비교 표시 |
| **허용 오차 입력** | ✅ | 리밸런싱 허용 오차 비율 설정 (v0.5.0) |

### 2.4 플랜 설정 (`/rebalance/plans`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 플랜 목록 | ✅ | 생성된 리밸런싱 플랜 목록 |
| 플랜 생성 | ✅ | 이름, 설명, 전략 프롬프트 설정 |
| 플랜 편집 | ✅ | 목표 비율 수정, 항목 추가/삭제 |
| 플랜 삭제 | ✅ | 플랜 삭제 |
| 메인 플랜 설정 | ✅ | 대시보드/리밸런싱에서 사용할 플랜 지정 |
| **개별 배분** | ✅ | 개별 자산별 목표 비율 설정 |
| **그룹 배분** | ✅ | 여러 자산을 그룹으로 묶어 목표 비율 설정 |
| 그룹 내 자산 관리 | ✅ | 그룹에 자산 추가/제거 |
| 균등 배분 | ✅ | 모든 항목 동일 비율 자동 설정 |
| 현재 비율 적용 | ✅ | 현재 보유 비율을 목표로 설정 |
| 자산 매칭 | ✅ | 티커/이름 기반 자동 매칭 |
| **실시간 파이차트** | ✅ | 목표 비율 변경 시 즉시 시각화 (Phase 1) |
| **비율 정규화** | ✅ | 100%에 맞게 비율 자동 조정 버튼 (Phase 1) |
| **보유 자산 선택 UI** | ✅ | 체크박스 기반 자산 선택 모달 (Phase 1) |
| **자동 저장/복구** | ✅ | localStorage 자동 저장 및 복구 프롬프트 (Phase 1) |

### 2.5 분석 (`/analytics`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 리밸런싱 분석 | ✅ | 플랜 기준 상세 분석 |
| 편차 분석 | ✅ | 목표 대비 현재 편차 시각화 |

### 2.6 설정 (`/settings`)

| 기능 | 상태 | 설명 |
|------|------|------|
| 다크 모드 | ✅ | 테마 토글 |
| 포트폴리오 관리 | ✅ | 포트폴리오 선택/관리 |

### 2.7 배포 (v0.5.0)

| 기능 | 상태 | 설명 |
|------|------|------|
| Docker 이미지 빌드 | ✅ | docker-compose를 통한 빌드 |
| NAS 배포 | ✅ | Synology NAS 이미지 전송 방식 |
| 외부 접속 | ✅ | DDNS + 포트포워딩 설정 |
| 배포 스크립트 | ✅ | start.sh, stop.sh, update.sh, logs.sh |

---

## 3. API 엔드포인트

### 자산 API (`/api/v1/assets`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/assets` | 자산 목록 (현재가 포함) |
| POST | `/api/v1/assets` | 자산 추가 |
| PUT | `/api/v1/assets/{id}` | 자산 수정 |
| DELETE | `/api/v1/assets/{id}` | 자산 삭제 |

### 대시보드 API (`/api/v1/dashboard`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/dashboard/summary` | 대시보드 요약 |
| GET | `/api/v1/dashboard/history` | 자산 추이 히스토리 |
| POST | `/api/v1/dashboard/rebalance` | 리밸런싱 계산 |

### 리밸런싱 플랜 API (`/api/v1/rebalance`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/rebalance/plans` | 플랜 목록 |
| POST | `/api/v1/rebalance/plans` | 플랜 생성 |
| PUT | `/api/v1/rebalance/plans/{id}` | 플랜 수정 |
| DELETE | `/api/v1/rebalance/plans/{id}` | 플랜 삭제 |
| PUT | `/api/v1/rebalance/plans/{id}/main` | 메인 플랜 설정 |

---

## 4. 데이터 모델

### 핵심 테이블

```
portfolios          - 포트폴리오 메타정보
assets              - 보유 자산 (ticker, quantity, average_price)
asset_categories    - 자산 카테고리
asset_history       - 일별 스냅샷 (total_value, profit_rate)
rebalance_plans     - 리밸런싱 플랜
plan_allocations    - 플랜 내 개별 배분 항목
plan_groups         - 플랜 내 그룹 배분
plan_group_items    - 그룹 내 자산 항목
target_allocations  - (레거시) 목표 배분 비율
```

### 주요 타입 (Frontend)

```typescript
// 자산
interface Asset {
  id: string
  ticker: string | null
  name: string
  quantity: number
  average_price: number
  current_price: number
  market_value: number
  currency: 'KRW' | 'USD'
  profit_rate: number
  category_id: string
}

// 리밸런싱 플랜
interface RebalancePlan {
  id: string
  name: string
  description?: string
  strategy_prompt?: string
  is_main: boolean
  allocations: AllocationItem[]
  groups: GroupAllocation[]
}

// 그룹 배분
interface GroupAllocation {
  id: string
  name: string
  target_ratio: number
  items: GroupItem[]
}
```

---

## 5. 버그 수정 이력

### 2026-01-17: 그룹 금액 NaN 및 도넛 차트 버그 수정

**커밋**: `167189c`

**문제**:
1. 플랜 편집 화면에서 그룹 금액이 NaN으로 표시
2. 대시보드 도넛 차트에서 메인 플랜 설정 시 "기타"만 표시

**원인**:
- `market_value`가 string으로 전달될 때 `isNaN()` 체크 우회
- `Number()` 명시적 변환 누락

**수정 파일**:
- `frontend/src/components/rebalance/AllocationEditor.tsx`
  - `getCurrentValue()`, `getItemValueInKRW()` 함수에 `Number()` 변환 및 `isFinite()` 체크 추가
- `frontend/src/components/dashboard/PortfolioDonut.tsx`
  - `safeNumber()` 헬퍼 함수 추가
  - `buildChartFromPlan()` 내 모든 숫자 연산에 안전 변환 적용

**테스트 결과**:
- Backend: 28 tests passed
- Frontend: Build successful
- UI: Playwright MCP로 검증 완료

### 2026-01-17: 플랜 편집 UX 개선 (Phase 1)

**커밋**: `fcb71d9`

**개선 내용**:
1. 실시간 파이차트로 목표 비율 시각화
2. "100%로 정규화" 버튼으로 비율 자동 조정
3. 체크박스 기반 보유 자산 선택 UI
4. localStorage 자동 저장 및 복구 기능

**추가된 컴포넌트**:
- `frontend/src/components/rebalance/RealTimePieChart.tsx` - 실시간 파이차트
- `frontend/src/components/rebalance/AssetSelectorModal.tsx` - 자산 선택 모달
- `frontend/src/hooks/useAutoSave.ts` - 자동 저장 훅
- `frontend/src/components/ui/checkbox.tsx` - shadcn/ui 체크박스
- `frontend/src/components/ui/scroll-area.tsx` - shadcn/ui 스크롤 영역

**수정된 파일**:
- `frontend/src/components/rebalance/AllocationEditor.tsx`
  - 파이차트 섹션 추가 (상단)
  - 정규화 버튼 추가 (100% 미만/초과 시 표시)
  - "보유 자산 선택" 버튼 추가 (개별 배분, 그룹 내)
  - 자동 저장 표시 및 복구 프롬프트

**테스트 결과**:
- Frontend: Build successful
- UI: Playwright MCP로 검증 완료
  - 복구 프롬프트 표시/무시/복구 동작 확인
  - 파이차트 실시간 업데이트 확인
  - 보유 자산 선택 모달 동작 확인
  - 정규화 버튼 동작 확인 (30%:50% → 37.5%:62.5%)

### 2026-01-18: v0.5.0 Docker 배포 및 UI 개선

**커밋**: `d1c0655`, `6ef48ab`

**개선 내용**:
1. Docker 배포 지원 (Synology NAS)
2. 외부 접속 설정 (DDNS + 포트포워딩)
3. UI 개선
   - 대시보드 환율 중복 표시 제거
   - 자산 추이 차트 Y축 잘림 수정
   - 리밸런싱 허용 오차 입력 UI 추가
   - 플랜 편집 버튼 배치 재정렬

**추가된 파일**:
- `deploy/docker-compose.yml` - NAS용 프로덕션 설정
- `deploy/.env.example` - 환경변수 템플릿
- `deploy/README.md` - 배포 가이드
- `deploy/start.sh`, `stop.sh`, `update.sh`, `logs.sh` - 관리 스크립트

---

## 6. 개발 환경 설정

### MCP 서버 (Playwright)

`.mcp.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@playwright/mcp@latest"]
    }
  }
}
```

### 실행 명령어

```bash
# Backend
cd backend && python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Tests
cd backend && python -m pytest -v
cd frontend && npm run build
```

---

## 7. 향후 계획 (미구현)

| 기능 | 우선순위 | 설명 |
|------|----------|------|
| **클립보드 데이터 가져오기** | 높음 | 증권사 MTS/HTS에서 복사한 보유종목 데이터 파싱 (Phase 2) |
| AI 분석 | 중간 | 전략 프롬프트 기반 AI 리밸런싱 조언 |
| 알림 기능 | 낮음 | 목표 편차 임계값 초과 시 알림 |
| 다중 포트폴리오 | 낮음 | 여러 포트폴리오 동시 관리 |
| 배당 추적 | 낮음 | 배당금 수령 내역 관리 |
| 거래 기록 | 낮음 | 매수/매도 히스토리 |

### Phase 2: 클립보드 데이터 가져오기 (대기 중)

**상태**: 샘플 데이터 필요

**계획된 기능**:
- 미래에셋증권 등 MTS/HTS에서 보유종목 데이터 복사
- 텍스트 영역에 붙여넣기 → 자동 파싱
- 파싱 결과 미리보기 → 가져오기 확인
- 기존 자산과 중복 시 자동 업데이트

**대기 이유**:
- 미래에셋증권 클립보드 데이터 형식 샘플 필요
- 웹 검색으로 구체적인 형식 찾지 못함

---

## 8. 참고 문서

- [CLAUDE.md](../CLAUDE.md) - 프로젝트 컨벤션 및 구조
- [database/schema.sql](../database/schema.sql) - DB 스키마
- [docs/specs/](./specs/) - 개별 기능 스펙 문서
