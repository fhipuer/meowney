# 대시보드/자산목록/리밸런싱 계산 로직 일원화 스펙

## 1. 개요

### 배경 및 목적
현재 Meowney 프로젝트의 계산 로직이 여러 파일에 분산되어 있으며, 특히 USD 자산의 환율 적용 기준이 불일치하여 화면별로 다른 총자산/수익률이 표시될 수 있는 문제가 있다.

### 핵심 가치 제안
- **정확성**: 모든 화면에서 동일한 총자산, 수익률 표시
- **유지보수성**: 계산 로직을 백엔드에 중앙 집중화
- **일관성**: USD 환율 처리, 비티커 자산 처리 로직 통일

### 버전
- 현재: v0.6.1
- 목표: **v0.7.0** (Breaking Change 포함)

---

## 2. 요구사항

### 기능 요구사항

#### FR-1: USD 자산 환율 기준 통일
- **원금(principal) 계산**: 매수 시점 환율(`purchase_exchange_rate`) 사용
- **폴백 로직**: 매수 시점 환율이 없으면 현재 환율로 폴백
- **적용 범위**: 대시보드 summary, 자산 목록, 리밸런싱 모두 동일 로직

#### FR-2: 계산 로직 중앙화
- 모든 계산은 백엔드 `asset_service.py`에서 수행
- 프론트엔드는 API 응답 표시만 담당
- `AssetsPage.tsx`의 summary 재계산 로직 제거

#### FR-3: 환율 기본값 통일
- 모든 곳에서 `settings.default_usd_krw_rate` 사용
- `asset_service.py`의 하드코딩된 1300 제거

#### FR-4: 환율 조회 실패 처리
- 마지막 성공 조회 환율 캐시
- 실패 시 캐시된 환율 사용
- 캐시도 없으면 `settings.default_usd_krw_rate` 사용

#### FR-5: 비티커 자산 처리 통일
- `current_value`를 `market_value`로 사용
- 수익률: `(current_value - 원금) / 원금 * 100`

#### FR-6: 리밸런싱 로직 통합
- 레거시 카테고리 기반 API 제거 (`POST /dashboard/rebalance`)
- 플랜 기반 리밸런싱으로 통합
- USD 자산도 동일한 환율 로직 적용

#### FR-7: Assets API 응답 확장
- 기존: 개별 자산 배열만 반환
- 변경: `{ assets: [...], summary: { total_value, total_principal, profit, profit_rate } }` 형태

### 비기능 요구사항

#### NFR-1: 성능
- 중복 계산 제거로 API 응답 시간 유지 또는 개선
- 환율 캐싱으로 외부 API 호출 최소화

#### NFR-2: 하위 호환성
- Breaking Change: 레거시 리밸런싱 API 제거
- Assets API 응답 구조 변경 (기존 배열 → 객체)

---

## 3. 사용자 시나리오

### 시나리오 1: USD 자산 포함 포트폴리오 조회
1. 사용자가 대시보드 접속
2. 백엔드에서 모든 자산의 market_value를 원화로 환산
3. USD 자산: `현재가 × 수량 × 현재환율`
4. USD 자산 원금: `평균매수가 × 수량 × 매수시점환율`
5. 총자산, 수익률 계산하여 응답
6. 자산 목록 페이지에서도 동일한 총자산 표시

### 시나리오 2: 리밸런싱 계산
1. 사용자가 리밸런싱 페이지 접속
2. 플랜 선택 필수
3. 플랜 기반 목표 비율과 현재 비율 비교
4. 매수/매도 제안 표시

### 시나리오 3: 환율 조회 실패
1. yfinance에서 환율 조회 실패
2. 캐시된 환율 사용 (최근 성공 조회값)
3. 캐시 없으면 설정 기본값 사용
4. 서비스 중단 없이 계속 동작

---

## 4. 기술 설계

### 아키텍처

```
[Frontend]                    [Backend]

DashboardPage.tsx  ──────►  GET /api/v1/dashboard/summary
    │                              │
    │                              ▼
    │                      asset_service.calculate_summary()
    │                              │
    │                              ▼
    │                      finance_service.enrich_assets_with_prices()
    │                              │
    │                              ▼
    │                      USD 환율 적용 (매수시점 환율 기준)
    │                              │
    └─────────────────────────────┘

AssetsPage.tsx  ──────────►  GET /api/v1/assets
    │                              │
    │                              ▼
    │                      { assets: [...], summary: {...} }
    │                              │
    └─────────────────────────────┘
    (프론트엔드 재계산 제거)

RebalancePage.tsx  ────────►  GET /api/v1/plans/{id}/rebalance
    │                              │
    │                              ▼
    │                      rebalance_service.calculate_rebalance_by_plan()
    │                              │
    └─────────────────────────────┘
```

### 데이터 모델

#### 환율 캐시 (메모리)
```python
class ExchangeRateCache:
    rate: Decimal
    timestamp: datetime
    source: str  # "yfinance" | "fallback"
```

#### Assets API 응답 변경
```typescript
// Before
type AssetsResponse = Asset[]

// After
interface AssetsResponse {
  assets: Asset[]
  summary: {
    total_value: number      // 총 평가금액 (KRW)
    total_principal: number  // 총 투자원금 (KRW)
    total_profit: number     // 총 손익 (KRW)
    profit_rate: number      // 수익률 (%)
  }
}
```

### API 설계 변경

#### 제거되는 API
```
DELETE: POST /api/v1/dashboard/rebalance
```

#### 변경되는 API
```
GET /api/v1/assets
- Response: Asset[] → { assets: Asset[], summary: AssetsSummary }

GET /api/v1/plans/{plan_id}/rebalance
- 기존 유지, USD 환율 로직만 통일
```

### 핵심 계산 로직 (Pseudo Code)

```python
def calculate_market_value(asset, current_exchange_rate):
    """자산의 평가금액 계산 (원화)"""
    if asset.ticker:
        # 티커 있는 자산
        current_price = get_current_price(asset.ticker)
        market_value = current_price * asset.quantity

        if asset.currency == "USD":
            market_value = market_value * current_exchange_rate
    else:
        # 티커 없는 자산 (현금, 금현물 등)
        market_value = asset.current_value

    return market_value

def calculate_principal(asset, current_exchange_rate):
    """자산의 투자원금 계산 (원화)"""
    principal = asset.average_price * asset.quantity

    if asset.currency == "USD":
        # 매수 시점 환율 사용, 없으면 현재 환율로 폴백
        purchase_rate = asset.purchase_exchange_rate or current_exchange_rate
        principal = principal * purchase_rate

    return principal

def calculate_profit_rate(market_value, principal):
    """수익률 계산"""
    if principal > 0:
        return (market_value - principal) / principal * 100
    return 0.0
```

---

## 5. UI/UX 설계

### 변경사항

#### AssetsPage.tsx
- 기존: `useMemo`로 summary 재계산
- 변경: API 응답의 `summary` 필드 사용

```tsx
// Before
const summary = useMemo(() => {
  const totalValue = assets.reduce((sum, a) => sum + a.market_value, 0)
  // ...
}, [assets])

// After
const { data } = useAssets()
const summary = data?.summary  // API에서 제공
```

#### RebalanceCalculator.tsx
- 기존: 카테고리 기반 타겟 입력
- 변경: 플랜 선택 필수, 플랜 기반 계산

---

## 6. 보안 고려사항

- 환율 API 키 노출 없음 (yfinance 사용)
- 민감 데이터 변경 없음

---

## 7. 테스트 계획

### 단위 테스트 추가

#### test_calculation_logic.py
```python
def test_usd_asset_market_value_conversion():
    """USD 자산 평가금액 원화 환산 테스트"""

def test_usd_asset_principal_with_purchase_rate():
    """USD 자산 원금 - 매수시점 환율 사용 테스트"""

def test_usd_asset_principal_fallback_to_current_rate():
    """USD 자산 원금 - 환율 폴백 테스트"""

def test_non_ticker_asset_calculation():
    """비티커 자산 계산 테스트"""

def test_exchange_rate_cache_on_failure():
    """환율 조회 실패 시 캐시 사용 테스트"""

def test_total_value_consistency():
    """대시보드와 자산목록 총자산 일치 테스트"""
```

### 통합 테스트
- API 엔드포인트별 응답 검증
- USD 자산 포함 시나리오 E2E 테스트

---

## 8. 제약사항 및 가정

### 제약사항
- Breaking Change: 레거시 리밸런싱 API 제거
- Assets API 응답 구조 변경으로 프론트엔드 수정 필수

### 가정
- 매수 시점 환율이 없는 기존 USD 자산은 현재 환율로 계산
- 환율 캐시는 서버 재시작 시 초기화됨

---

## 9. 구현 순서

### Phase 1: 계산 로직 통일
1. `finance_service.py`: 환율 캐시 구현
2. `asset_service.py`: 하드코딩 환율 제거, settings 사용
3. `asset_service.py`: USD 원금 계산 시 매수시점 환율 적용
4. 단위 테스트 추가

### Phase 2: API 정리
1. `assets.py`: 응답에 summary 추가
2. `dashboard.py`: 레거시 리밸런싱 API 제거
3. `rebalance_service.py`: USD 환율 로직 통일

### Phase 3: UI 전환
1. `AssetsPage.tsx`: summary 재계산 제거, API 응답 사용
2. `RebalanceCalculator.tsx`: 플랜 기반으로 전환
3. 관련 타입 정의 업데이트

---

## 10. 체크리스트

- [ ] USD 환율 기준 통일 (매수시점 환율)
- [ ] 환율 기본값 settings로 통일
- [ ] 환율 캐시 구현
- [ ] Assets API 응답에 summary 추가
- [ ] 레거시 리밸런싱 API 제거
- [ ] AssetsPage.tsx 재계산 로직 제거
- [ ] RebalanceCalculator.tsx 플랜 기반 전환
- [ ] 단위 테스트 추가
- [ ] 버전 v0.7.0 업데이트
