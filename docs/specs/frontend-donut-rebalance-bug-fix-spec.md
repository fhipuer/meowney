# 프론트엔드 표시 및 리밸런싱 계산 오류 수정 스펙

## 1. 개요

### 배경 및 목적
대시보드 도넛 차트와 플랜 편집기(AllocationEditor)에서 자산 비율과 금액이 잘못 표시되는 버그를 수정합니다.

### 핵심 가치 제안
- 정확한 포트폴리오 배분 비율 표시
- 현금, 금 등 수동 입력 자산(current_value)의 정상적인 매칭 및 계산
- TDD 기반 안정적인 수정

### 제약사항
- **DB 데이터 수정 불가**: 기존 저장된 플랜 데이터를 변경하지 않음
- 매칭 로직 개선으로 해결

---

## 2. 버그 상세 분석

### 버그 #1: 도넛 차트 비율 계산 오류

**증상**:
- AI 반도체 그룹: 실제 ~35% → 표시 16.4%
- 단기채 그룹: 실제 ~30% → 표시 41.7%
- 현금: 실제 ~10% → 표시 0%

**원인**: `PortfolioDonut.tsx`의 `buildChartFromPlan()` 함수
```typescript
// 라인 116-118, 142-144, 166-168
if (matched.currency === 'USD') {
  value = value * safeRate  // ← 문제: market_value는 이미 원화
}
```

**근본 원인**:
- `market_value`는 백엔드에서 이미 원화로 환산되어 반환됨
- 프론트엔드에서 USD 자산에 환율(~1472)을 또 곱함
- 결과: USD 자산 가치가 약 1472배 증폭되어 비율 왜곡

**검증 데이터** (API 응답):
```json
{
  "name": "나스닥 반도체 ETF",
  "ticker": "SMH",
  "currency": "USD",
  "market_value": "15920235.10980",    // ← 이미 원화 (약 1592만원)
  "market_value_usd": "10810.530"      // ← 달러 원본
}
```

### 버그 #2: 그룹 아이템 0원 표시 (도넛 차트 + AllocationEditor)

**증상**:
- 금 그룹의 '국내 금현물' 자산이 0원으로 계산됨
- 현금 개별 배분이 0%로 표시됨

**원인**: `matchItemToAsset()` 함수의 매칭 로직 한계
```typescript
// 현재 매칭 순서: asset_id → ticker → alias(부분일치)
```

**문제 상황**:
1. '국내 금현물' 자산: `ticker: null`, `name: "국내 금현물"`
2. 플랜 그룹 아이템: `ticker: "국내 금현물"` (사용자가 자산명을 ticker란에 입력)
3. 매칭 시도: `assets.find(a => a.ticker === "국내 금현물")` → 실패 (실제 ticker는 null)

**플랜 데이터** (API 응답):
```json
{
  "name": "금",
  "items": [
    {
      "asset_id": null,
      "ticker": "국내 금현물",  // ← 문제: 이건 name이지 ticker가 아님
      "alias": null
    }
  ]
}
```

### 버그 #3: 리밸런싱 제안 API 계산 오류 (확인 필요)

백엔드 `rebalance_service.py`의 `match_item_to_asset()` 및 그룹 계산 로직에서 동일한 매칭 문제가 발생할 수 있음.

---

## 3. 요구사항

### 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-1 | 도넛 차트에서 USD 자산 환율 이중 적용 제거 | 높음 |
| FR-2 | matchItemToAsset에 name 기반 매칭 추가 | 높음 |
| FR-3 | 백엔드 rebalance_service 매칭 로직 동일하게 개선 | 높음 |
| FR-4 | AllocationEditor에서 그룹 아이템 금액 정상 표시 | 높음 |

### 비기능 요구사항

| ID | 요구사항 |
|----|----------|
| NFR-1 | 기존 테스트 케이스 통과 유지 |
| NFR-2 | 새로운 테스트 케이스 추가 (매칭 로직, 비율 계산) |
| NFR-3 | DB 스키마 및 저장된 데이터 변경 없음 |

---

## 4. 기술 설계

### 4.1 프론트엔드 수정

#### `PortfolioDonut.tsx` 수정

**파일**: `frontend/src/components/dashboard/PortfolioDonut.tsx`

```typescript
// 수정 전 (라인 114-118)
if (matched) {
  matchedAssetIds.add(matched.id)
  value = safeNumber(matched.market_value)
  if (matched.currency === 'USD') {
    value = value * safeRate  // 제거
  }
}

// 수정 후
if (matched) {
  matchedAssetIds.add(matched.id)
  value = safeNumber(matched.market_value)
  // market_value는 이미 원화로 환산되어 있음 (백엔드 처리)
}
```

동일한 수정을 라인 140-145, 164-168에도 적용.

#### `matchItemToAsset()` 함수 개선

```typescript
// 수정 후 (라인 56-82)
function matchItemToAsset(
  item: { asset_id?: string | null; ticker?: string | null; alias?: string | null },
  assets: Asset[]
): Asset | undefined {
  if (!assets || assets.length === 0) return undefined

  // 1. asset_id로 매칭 (최우선)
  if (item.asset_id) {
    const matched = assets.find((a) => a.id === item.asset_id)
    if (matched) return matched
  }

  // 2. ticker로 정확히 매칭
  if (item.ticker) {
    const matched = assets.find((a) => a.ticker === item.ticker)
    if (matched) return matched

    // 2-1. ticker 값이 실제로는 name일 수 있음 (사용자 입력 오류 대응)
    const matchedByName = assets.find((a) => a.name === item.ticker)
    if (matchedByName) return matchedByName
  }

  // 3. alias로 부분 매칭
  if (item.alias) {
    const aliasLower = item.alias.toLowerCase()
    const matched = assets.find((a) => {
      const nameLower = a.name.toLowerCase()
      return aliasLower.includes(nameLower) || nameLower.includes(aliasLower)
    })
    if (matched) return matched
  }

  return undefined
}
```

### 4.2 백엔드 수정

#### `rebalance_service.py` 매칭 로직 개선

**파일**: `backend/app/services/rebalance_service.py`

```python
# 수정 후 (match_item_to_asset 메서드)
def match_item_to_asset(self, item: dict, assets: list[dict]) -> dict | None:
    """플랜 아이템을 자산과 매칭 냥~"""

    # 1. asset_id로 매칭 (최우선)
    if item.get("asset_id"):
        asset_id = str(item["asset_id"])
        for asset in assets:
            if str(asset.get("id")) == asset_id:
                return asset

    # 2. ticker로 정확히 매칭
    if item.get("ticker"):
        ticker = item["ticker"]
        for asset in assets:
            if asset.get("ticker") == ticker:
                return asset

        # 2-1. ticker 값이 실제로는 name일 수 있음
        for asset in assets:
            if asset.get("name") == ticker:
                return asset

    # 3. alias로 부분 매칭
    if item.get("alias"):
        alias_lower = item["alias"].lower()
        for asset in assets:
            name_lower = asset.get("name", "").lower()
            if alias_lower in name_lower or name_lower in alias_lower:
                return asset

    return None
```

### 4.3 AllocationEditor 수정

**파일**: `frontend/src/components/rebalance/AllocationEditor.tsx`

동일한 `matchItemToAsset` 로직이 사용되는 경우 공통 유틸로 추출하거나 동일하게 수정.

---

## 5. 테스트 계획

### 5.1 프론트엔드 테스트

| 테스트 케이스 | 설명 |
|--------------|------|
| USD 자산 비율 계산 | USD 자산의 market_value가 환율 이중 적용 없이 정확히 계산되는지 |
| name 기반 매칭 | ticker가 null이고 name으로 매칭해야 하는 자산 |
| 혼합 포트폴리오 비율 | KRW + USD + current_value 자산 혼합 시 비율 정확성 |

### 5.2 백엔드 테스트 (pytest)

| 테스트 케이스 | 파일 | 설명 |
|--------------|------|------|
| `test_match_by_name_when_ticker_is_name` | test_rebalance_service.py | ticker 필드에 name이 저장된 경우 매칭 |
| `test_group_with_name_matched_asset` | test_rebalance_service.py | name으로 매칭된 자산이 그룹 계산에 포함 |
| `test_suggestion_with_current_value_asset` | test_rebalance_service.py | current_value 자산의 리밸런싱 제안 |

### 5.3 E2E 테스트 (Playwright)

1. 대시보드 도넛 차트 비율 검증
2. 플랜 편집기 그룹 아이템 금액 표시 검증
3. 리밸런싱 제안 결과 검증

---

## 6. 수정 파일 목록

| 파일 | 작업 |
|------|------|
| `frontend/src/components/dashboard/PortfolioDonut.tsx` | USD 환율 이중 적용 제거, matchItemToAsset 개선 |
| `frontend/src/components/rebalance/AllocationEditor.tsx` | matchItemToAsset 동일 수정 (공통 유틸 추출 고려) |
| `backend/app/services/rebalance_service.py` | match_item_to_asset 메서드에 name 매칭 추가 |
| `backend/tests/test_rebalance_service.py` | name 매칭 테스트 케이스 추가 |

---

## 7. 미결정 사항 / 추후 논의 필요

1. **공통 유틸 추출**: 프론트엔드의 `matchItemToAsset`을 `lib/utils.ts`로 추출할지
2. **플랜 저장 시 검증**: 향후 플랜 아이템 저장 시 ticker/name 혼동 방지 로직 추가 검토
3. **백엔드 plans API에 matched_asset 포함**: 프론트엔드 매칭 로직 부담 감소 (장기 개선)

---

## 8. 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 1.0 | 2026-01-19 | Claude | 초안 작성 |
