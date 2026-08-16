# 백엔드 계산 로직 테스트 강화 스펙

## 1. 개요

### 배경 및 목적
Meowney 백엔드의 자산 계산 로직에서 현금성 자산(current_value만 사용)이 제대로 계산되지 않는 버그가 발견됨. 이를 수정하고 전체 계산 로직에 대한 테스트 커버리지를 확보한다.

### 핵심 가치 제안
- **버그 수정**: 현금성 자산의 비율/금액 계산 오류 해결
- **테스트 강화**: 핵심 계산 함수 100% 테스트 커버리지
- **회귀 방지**: 향후 계산 로직 변경 시 버그 조기 발견

---

## 2. 요구사항

### 기능 요구사항

#### 2.1 버그 수정 (2건)

**버그 #1: 대시보드 도넛 차트에서 현금 비율 0%**
- **증상**: current_value로 입력한 현금 자산이 도넛 차트에서 0%로 표시
- **원인 추정**: market_value 계산 시 current_value 미사용
- **수정 대상**: `finance_service.enrich_assets_with_prices()` 또는 `asset_service.calculate_summary()`

**버그 #2: 플랜 그룹에서 현금/금현물 매칭 시 0원**
- **증상**: 보유 자산(asset_id)으로 그룹에 연결하면 current_value가 0원으로 계산
- **원인 추정**: `rebalance_service._calculate_group_suggestion()`에서 current_value 처리 누락
- **수정 대상**: `rebalance_service.py`

### 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| 테스트 프레임워크 | pytest |
| 테스트 위치 | `backend/tests/` |
| DB 모킹 | 모킹 데이터 사용 (Supabase 연결 없음) |
| 커버리지 목표 | 핵심 계산 함수 100% |
| 엣지 케이스 | 포함 (빈 포트폴리오, 0원 자산, 음수 등) |

---

## 3. 테스트 대상 함수

### 3.1 FinanceService (finance_service.py)

| 함수 | 설명 | 테스트 케이스 |
|------|------|--------------|
| `enrich_assets_with_prices()` | 자산에 현재가/평가금액 추가 | KRW 주식, USD 주식, 현금(current_value), 빈 목록 |
| `get_exchange_rate()` | USD/KRW 환율 조회 | 성공, 캐시 히트, 실패 시 기본값 |

### 3.2 AssetService (asset_service.py)

| 함수 | 설명 | 테스트 케이스 |
|------|------|--------------|
| `calculate_summary()` | 대시보드 요약 계산 | KRW만, USD 포함, 현금 포함, 혼합, 빈 목록 |
| `calculate_rebalance()` | 카테고리 기준 리밸런싱 (레거시) | 균형, 매수 필요, 매도 필요, 빈 목표 |

### 3.3 RebalanceService (rebalance_service.py)

| 함수 | 설명 | 테스트 케이스 |
|------|------|--------------|
| `calculate_rebalance_by_plan()` | 플랜 기준 리밸런싱 | 개별 배분, 그룹 배분, 혼합, 빈 플랜 |
| `_calculate_allocation_suggestion()` | 개별 배분 제안 | 매칭됨, 매칭 안됨, current_value 자산 |
| `_calculate_group_suggestion()` | 그룹 배분 제안 | **현금 포함 그룹**, 빈 그룹 |
| `_match_item_to_asset()` | 자산 매칭 | asset_id, ticker, alias 우선순위 |

---

## 4. 테스트 케이스 상세

### 4.1 현금성 자산 계산 케이스 (핵심)

```python
# 현금 자산 데이터 구조
cash_asset = {
    "id": "uuid-cash",
    "name": "CMA 계좌",
    "ticker": None,
    "quantity": 0,  # 또는 Decimal("0")
    "average_price": 0,
    "currency": "KRW",
    "current_value": 5000000,  # 직접 입력한 금액
    "category_id": "cash-uuid"
}

# 기대 결과
expected = {
    "market_value": 5000000,  # current_value 그대로
    "profit_loss": 5000000,   # 원금 0이므로
    "profit_rate": 0.0        # 원금 없으므로 0%
}
```

### 4.2 USD 환율 환산 케이스

```python
# USD 자산 데이터
usd_asset = {
    "id": "uuid-usd",
    "name": "VOO",
    "ticker": "VOO",
    "quantity": 10,
    "average_price": 400,  # USD
    "currency": "USD",
    "purchase_exchange_rate": 1300,
    "current_value": None
}

# 현재가 $450, 환율 1350 가정
expected = {
    "market_value": 4500000,  # 450 * 10 * 1350 = 6,075,000 (원화)
    "cost_basis_krw": 5200000,  # 400 * 10 * 1300 = 5,200,000
    "profit_loss": 875000
}
```

### 4.3 그룹 리밸런싱 케이스 (버그 관련)

```python
# 그룹에 현금 자산 포함
group = {
    "name": "안전자산",
    "target_percentage": 30,
    "items": [
        {"asset_id": "uuid-cash"},  # current_value=5000000
        {"asset_id": "uuid-bond"}   # market_value=3000000
    ]
}

# 총 자산 20,000,000 가정
expected = {
    "group_current_value": 8000000,  # 5000000 + 3000000
    "current_percentage": 40.0,
    "target_value": 6000000,  # 20000000 * 0.3
    "suggested_amount": -2000000  # 비중 축소 필요
}
```

### 4.4 엣지 케이스

| 케이스 | 입력 | 기대 결과 |
|--------|------|----------|
| 빈 포트폴리오 | `assets = []` | total_value=0, allocations=[] |
| 0원 자산 | quantity=0, current_value=0 | market_value=0, 비율 계산에서 제외 |
| 음수 수익률 | 손실 상태 | profit_rate < 0 정상 표시 |
| 환율 조회 실패 | yfinance 에러 | 기본 환율 1300 사용 |
| 티커 조회 실패 | 잘못된 티커 | current_price=None, 경고 로그 |

---

## 5. 구현 계획

### 5.1 TDD 접근 방식

```
1. 실패하는 테스트 작성 (현금 비율 0% 재현)
2. 버그 원인 파악 및 코드 수정
3. 테스트 통과 확인
4. 추가 테스트 케이스 작성
5. 리팩토링 (필요 시)
```

### 5.2 테스트 파일 구조

```
backend/tests/
├── test_asset_service.py      # 기존 + 확장
├── test_finance_service.py    # 신규
├── test_rebalance_service.py  # 신규
├── conftest.py                # 공통 fixtures
└── fixtures/
    └── sample_data.py         # 모킹 데이터
```

### 5.3 작업 순서

| 순서 | 작업 | 예상 결과 |
|------|------|----------|
| 1 | 현금 비율 0% 버그 재현 테스트 | 테스트 실패 |
| 2 | finance_service 또는 asset_service 수정 | 테스트 통과 |
| 3 | 그룹 매칭 0원 버그 재현 테스트 | 테스트 실패 |
| 4 | rebalance_service 수정 | 테스트 통과 |
| 5 | 나머지 계산 함수 테스트 추가 | 커버리지 확보 |
| 6 | 엣지 케이스 테스트 추가 | 안정성 확보 |

---

## 6. 검증 방법

### 6.1 테스트 실행

```bash
cd backend
pytest tests/ -v
```

### 6.2 성공 기준

- [ ] 모든 테스트 통과
- [ ] 현금 자산 market_value 정상 계산
- [ ] 대시보드 도넛 차트에 현금 비율 표시
- [ ] 그룹 리밸런싱에서 현금 금액 정상 합산
- [ ] 핵심 계산 함수 테스트 커버리지 100%

---

## 7. 제약사항 및 가정

### 제약사항
- Supabase 연결 없이 모킹 데이터로만 테스트
- yfinance API 호출 모킹 필요
- 프론트엔드 테스트는 범위 외

### 가정
- 현금 자산은 항상 `ticker=None`, `current_value > 0` 형태
- USD 자산은 `currency="USD"`, `purchase_exchange_rate` 필수

---

## 8. 미결정 사항

- [ ] 커버리지 리포트 생성 여부 (pytest-cov)
- [ ] CI/CD 파이프라인 통합 (추후)
- [ ] 프론트엔드 E2E 테스트 (별도 작업)
