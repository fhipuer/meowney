# 그룹 금액 계산 및 대시보드 표시 버그 수정 스펙

## 1. 개요

### 배경 및 목적
플랜 편집 화면에서 그룹별 금액 총합이 NaN으로 표시되고, 대시보드 포트폴리오 배분 도넛 차트에서 메인 플랜이 있을 때 모든 자산이 "기타"로만 표시되는 버그 수정

### 핵심 가치 제안
- 정확한 그룹 금액 표시로 사용자가 리밸런싱 판단 가능
- 메인 플랜 기반 도넛 차트 정상 표시로 배분 현황 파악 용이

## 2. 요구사항

### 기능 요구사항
1. **그룹 금액 NaN 수정**: 플랜 편집 화면에서 그룹 현재가치가 정상 숫자로 표시되어야 함
2. **도넛 차트 표시 수정**: 메인 플랜이 있을 때 플랜의 배분 항목(개별/그룹)별로 정확한 비율 표시

### 비기능 요구사항
- NaN, undefined, null 값에 대한 방어적 코딩
- USD/KRW 환율 변환 정확성

## 3. 문제 분석

### 버그 1: 그룹 금액 NaN 표시

**증상**: 플랜 편집 화면 그룹 현재가치가 "₩NaN"으로 표시

**원인 추정** (코드 분석 기반):
- `AllocationEditor.tsx:426-428`의 `getGroupCurrentValue` 함수
- `getItemValueInKRW`에서 `matched_asset`이 undefined일 때 처리 미흡
- 또는 `market_value`가 string으로 넘어와 숫자 연산 실패

**관련 코드**:
```typescript
// AllocationEditor.tsx:412-423
const getItemValueInKRW = (item: GroupItem): number => {
  const asset = item.matched_asset
  const value = asset?.market_value
  if (!value || isNaN(value)) return 0  // 여기서 체크하지만...

  if (asset.currency === 'USD' && exchangeRate?.rate) {
    const converted = value * exchangeRate.rate
    return isNaN(converted) ? 0 : converted
  }
  return value
}
```

**문제점**:
1. `asset?.market_value`가 string일 경우 `isNaN(value)`가 false 반환 (문자열 "123"은 NaN이 아님)
2. string * number 연산 시 NaN 발생 가능
3. `exchangeRate?.rate`가 undefined일 때 처리 누락

### 버그 2: 대시보드 도넛 차트 "기타"만 표시

**증상**: 메인 플랜이 있을 때 모든 자산이 "기타"로 표시

**원인 추정** (코드 분석 기반):
- `PortfolioDonut.tsx:73-159`의 `buildChartFromPlan` 함수
- `matchItemToAsset` 함수의 매칭 실패
- 또는 `plan.allocations`, `plan.groups`가 비어있거나 undefined

**관련 코드**:
```typescript
// PortfolioDonut.tsx:180-183
if (mainPlan && ((mainPlan.allocations && mainPlan.allocations.length > 0) ||
    (mainPlan.groups && mainPlan.groups.length > 0))) {
  const planData = buildChartFromPlan(mainPlan, assets || [], rate)
  if (planData.length > 0) { ... }
}
```

**문제점**:
1. `buildChartFromPlan`에서 그룹만 있을 때 매칭 로직 검증 필요
2. `matchItemToAsset`이 그룹 아이템에 대해 정상 동작하는지 확인 필요
3. 모든 자산이 `matchedAssetIds`에 추가되지 않아 전부 "기타"로 분류될 가능성

## 4. 기술 설계

### 수정 대상 파일

1. **frontend/src/components/rebalance/AllocationEditor.tsx**
   - `getItemValueInKRW` 함수 강화
   - 숫자 변환 및 NaN 방어 로직 추가

2. **frontend/src/components/dashboard/PortfolioDonut.tsx**
   - `buildChartFromPlan` 함수 디버깅/수정
   - `matchItemToAsset` 매칭 로직 검증

### 수정 내용

#### AllocationEditor.tsx 수정
```typescript
const getItemValueInKRW = (item: GroupItem): number => {
  const asset = item.matched_asset
  if (!asset) return 0

  // 숫자로 명시적 변환
  const value = Number(asset.market_value)
  if (!value || isNaN(value) || !isFinite(value)) return 0

  if (asset.currency === 'USD') {
    const rate = Number(exchangeRate?.rate)
    if (!rate || isNaN(rate)) return 0  // 환율 없으면 0
    const converted = value * rate
    return isFinite(converted) ? converted : 0
  }
  return value
}
```

#### PortfolioDonut.tsx 디버깅 추가
- `buildChartFromPlan` 함수 내 console.log로 중간 값 확인
- 매칭 실패 시 원인 파악

## 5. 테스트 계획

### Backend API 테스트
- 기존 `test_rebalance.py` 테스트 실행하여 API 정상 확인

### Frontend UI 테스트

#### 테스트 케이스 1: 그룹 금액 표시
1. 플랜 편집 화면 열기
2. 그룹에 USD 자산(AAPL, SCHD 등) 추가
3. 그룹 총합 금액이 숫자로 정상 표시되는지 확인
4. KRW 자산 혼합 시에도 정상 표시 확인

#### 테스트 케이스 2: 도넛 차트 표시
1. 그룹만 있는 플랜 생성
2. 메인 플랜으로 설정
3. 대시보드에서 도넛 차트 확인
4. 그룹 이름으로 정상 표시되는지 확인
5. "기타"는 플랜에 포함되지 않은 자산만 표시되어야 함

#### 테스트 케이스 3: 개별 배분 + 그룹 혼합
1. 개별 배분과 그룹 배분이 함께 있는 플랜 생성
2. 메인 플랜으로 설정
3. 도넛 차트에 개별 항목과 그룹 모두 표시 확인

### Console 디버깅
- 브라우저 개발자 도구에서 다음 값 확인:
  - `matched_asset` 객체 내용
  - `market_value` 타입 및 값
  - `exchangeRate` 객체 내용
  - `buildChartFromPlan` 반환값

## 6. 제약사항 및 가정

- 환율 API가 정상 동작한다고 가정
- 자산 데이터의 `market_value`는 API에서 숫자 또는 숫자 문자열로 반환
- 매칭은 ticker 우선, alias(이름 포함) 차선으로 수행

## 7. 우선순위

1. **높음**: 그룹 금액 NaN 수정 (사용성 직접 영향)
2. **높음**: 도넛 차트 "기타" 문제 수정 (대시보드 핵심 기능)
3. **중간**: 디버깅 로그 추가 후 제거

## 8. 미결정 사항

- [ ] `market_value`가 string으로 오는지 number로 오는지 API 응답 확인 필요
- [ ] 그룹만 있는 플랜에서 개별 배분이 없을 때 동작 검증 필요
