# 대시보드 포트폴리오 배분 차트 개선 스펙

> 버전: v0.6.0
> 작성일: 2026-01-18
> 우선순위: 1순위

## 1. 개요

### 배경 및 목적
현재 대시보드의 포트폴리오 배분 파이 차트와 Summary Cards의 "총 자산" 값이 불일치하는 문제가 있음:
- Summary Cards: ₩80,321,306 (USD 자산을 달러 그대로 합산)
- 파이 차트: ₩177,648,949 (USD 자산을 원화 환산하여 합산)

또한 플랜에 포함되지 않은 자산이 "기타"로 표시되어 사용자가 이를 인지하지 못하는 문제가 있음.

### 핵심 가치 제안
1. **데이터 일관성**: Summary Cards와 파이 차트의 총 자산 값 일치
2. **명확한 정보 전달**: 플랜에 미배정된 자산을 시각적으로 구분하여 표시
3. **사용자 가이드**: 플랜 설정이 필요한 상황을 명확히 안내

---

## 2. 요구사항

### 기능 요구사항

#### FR-1: 총 자산 원화 환산 통합
- [ ] 백엔드 `/api/v1/dashboard/summary` API에서 USD 자산을 원화 환산하여 합산
- [ ] `current_exchange_rate` 필드 활용 (자산 조회 시 이미 포함됨)
- [ ] Summary Cards와 파이 차트가 동일한 API 데이터 소스 사용

#### FR-2: 미배정 자산 표시
- [ ] "기타" 레이블을 **"미배정 자산"**으로 변경
- [ ] 미배정 자산을 **경고색 (주황/빨강)**으로 시각적 구분
- [ ] 미배정 자산 호버 시 툴팁으로 안내: "이 자산은 현재 플랜에 포함되어 있지 않습니다"

#### FR-3: 플랜 상태별 차트 표시
| 상태 | 표시 내용 |
|------|----------|
| 플랜 없음 | 빈 차트 + "플랜을 생성해주세요" 메시지 + 플랜 생성 버튼 |
| 플랜 있음, 메인 미설정 | 빈 차트 + "메인 플랜을 선택해주세요" 메시지 + 플랜 설정 버튼 |
| 메인 플랜 설정됨 | 정상 차트 표시 (플랜명 뱃지 포함) |

#### FR-4: 플랜 삭제 시 자동 처리
- [ ] 플랜에서 자산 삭제 시 해당 자산은 자동으로 "미배정 자산"으로 이동

### 비기능 요구사항

#### NFR-1: 환율 캐싱
- [ ] 환율 조회 결과를 캐시 (현재 `FinanceService`에서 처리)
- [ ] 환율 조회 실패 시 마지막 성공한 환율 값 사용
- [ ] 캐시된 환율 사용 중임을 표시하지 않음 (사용자 혼란 방지)

#### NFR-2: 성능
- [ ] 파이 차트 렌더링 100ms 이내
- [ ] API 응답 시간 현재 수준 유지

---

## 3. 사용자 시나리오

### 시나리오 1: 신규 사용자
1. 사용자가 대시보드 접속
2. 파이 차트에 "플랜을 생성해주세요" 메시지 표시
3. "플랜 생성" 버튼 클릭 → 플랜 설정 페이지로 이동
4. 플랜 생성 후 대시보드로 복귀하면 정상 차트 표시

### 시나리오 2: 기존 사용자 - 미배정 자산 확인
1. 사용자가 대시보드 접속
2. 파이 차트에 "미배정 자산 38.2%" 주황색으로 표시
3. 해당 영역 호버 시 "이 자산은 현재 플랜에 포함되어 있지 않습니다" 툴팁 표시
4. 사용자가 플랜 설정 페이지에서 자산을 그룹에 추가
5. 대시보드로 복귀하면 "미배정 자산" 비율 감소 확인

### 시나리오 3: 환율 조회 실패
1. 네트워크 문제로 환율 조회 실패
2. 시스템이 마지막 성공한 환율로 총 자산 계산
3. 사용자는 정상적인 차트를 확인 (환율이 약간 오래됐을 수 있음)

---

## 4. 기술 설계

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                               │
├─────────────────────────────────────────────────────────────┤
│  DashboardPage                                              │
│  ├── SummaryCards (useDashboardSummary)                    │
│  │   └── total_value (원화 환산 합계)                       │
│  └── PortfolioDonut (useDashboardSummary + usePlans)       │
│      └── total_value 동일 값 사용                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend API                           │
├─────────────────────────────────────────────────────────────┤
│  GET /api/v1/dashboard/summary                             │
│  └── AssetService.calculate_summary()                      │
│      └── USD 자산 × current_exchange_rate → KRW 환산       │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 모델 변경

#### 백엔드 `calculate_summary` 수정
```python
# backend/app/services/asset_service.py

async def calculate_summary(self, enriched_assets, portfolio_id=None):
    total_value = Decimal("0")
    total_principal = Decimal("0")

    for asset in enriched_assets:
        market_value = Decimal(str(asset.get("market_value", 0)))
        currency = asset.get("currency", "KRW")

        # USD 자산은 원화로 환산
        if currency == "USD":
            exchange_rate = Decimal(str(asset.get("current_exchange_rate", 1300)))
            market_value = market_value * exchange_rate
            principal = principal * exchange_rate

        total_value += market_value
        total_principal += principal
```

#### 프론트엔드 `PortfolioDonut` 수정
```typescript
// frontend/src/components/dashboard/PortfolioDonut.tsx

// "기타" → "미배정 자산"으로 변경
const UNASSIGNED_LABEL = "미배정 자산"
const UNASSIGNED_COLOR = "#f97316" // orange-500

// 플랜 상태별 표시
if (!mainPlan) {
  if (plans?.length === 0) {
    return <EmptyChart message="플랜을 생성해주세요" action="create" />
  } else {
    return <EmptyChart message="메인 플랜을 선택해주세요" action="select" />
  }
}
```

### API 설계

기존 API 수정 (신규 API 없음):

| Endpoint | 변경 내용 |
|----------|----------|
| `GET /dashboard/summary` | `total_value`, `total_principal` 원화 환산 합산으로 변경 |

---

## 5. UI/UX 설계

### 파이 차트 레이아웃

```
┌─────────────────────────────────────────┐
│ 포트폴리오 배분 [기능 테스트용 플랜]     │
├─────────────────────────────────────────┤
│                                         │
│    ┌──────────────┐   AI 반도체  24.9%  │
│   ╱                ╲  단기채     37.0%  │
│  │   총 자산       │  ■ 미배정   38.2%  │ ← 주황색
│  │ ₩177,648,949   │                    │
│   ╲                ╱                    │
│    └──────────────┘                    │
│                                         │
└─────────────────────────────────────────┘
```

### 미배정 자산 툴팁
```
┌─────────────────────────────────────┐
│ 미배정 자산                          │
│ ₩67,784,512 (38.2%)                 │
│                                      │
│ 이 자산들은 현재 플랜에 포함되어      │
│ 있지 않습니다.                       │
└─────────────────────────────────────┘
```

### 플랜 없음 상태
```
┌─────────────────────────────────────────┐
│ 포트폴리오 배분                          │
├─────────────────────────────────────────┤
│                                         │
│           ╭───────────────╮             │
│           │  🐱           │             │
│           │ 플랜을        │             │
│           │ 생성해주세요   │             │
│           ╰───────────────╯             │
│                                         │
│         [플랜 생성하기]                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. 보안 고려사항

- 환율 정보는 공개 데이터이므로 특별한 보안 조치 불필요
- 자산 데이터는 기존 인증/인가 체계 유지

---

## 7. 테스트 계획

### 백엔드 단위 테스트 (pytest)
```python
# backend/tests/test_asset_service.py

def test_calculate_summary_usd_conversion():
    """USD 자산이 원화로 환산되어 합산되는지 검증"""
    assets = [
        {"market_value": 1000, "currency": "KRW", ...},
        {"market_value": 100, "currency": "USD", "current_exchange_rate": 1300, ...},
    ]
    summary = await service.calculate_summary(assets)
    assert summary.total_value == Decimal("131000")  # 1000 + 100*1300

def test_calculate_summary_missing_exchange_rate():
    """환율 정보 없을 때 기본값 사용 검증"""
    assets = [
        {"market_value": 100, "currency": "USD", ...},  # no exchange_rate
    ]
    summary = await service.calculate_summary(assets)
    assert summary.total_value == Decimal("130000")  # 100 * 1300 (기본값)
```

### 프론트엔드 UI 테스트 (Playwright MCP)
1. Summary Cards와 파이 차트의 총 자산 값 일치 확인
2. 미배정 자산이 주황색으로 표시되는지 확인
3. 미배정 자산 호버 시 툴팁 표시 확인
4. 플랜 없을 때 안내 메시지 및 버튼 표시 확인
5. 메인 플랜 미설정 시 다른 안내 메시지 표시 확인

---

## 8. 제약사항 및 가정

### 제약사항
- 환율은 yfinance의 `USDKRW=X` 티커에서 조회
- 환율 조회 실패 시 마지막 성공 값 또는 기본값(1,300원) 사용
- 실시간 환율 변동은 페이지 새로고침 시 반영

### 가정
- 사용자는 주로 KRW 기준으로 자산을 파악하고 싶어함
- 미배정 자산은 "관리되지 않는 자산"으로 인식, 플랜에 추가하도록 유도
- 환율이 약간 오래되어도 사용자 경험에 큰 영향 없음

---

## 9. 미결정 사항 / 추후 논의 필요

- [ ] 미배정 자산 클릭 시 동작: 현재는 툴팁만, 추후 플랜 편집으로 이동 가능
- [ ] 환율 캐시 만료 시간: 현재 세션 단위, 추후 5분/10분 등 설정 가능
- [ ] 다중 통화 지원 확장: 현재 USD/KRW만, 추후 EUR/JPY 등 확장 가능

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/services/asset_service.py` | `calculate_summary` USD 원화 환산 로직 추가 |
| `frontend/src/components/dashboard/PortfolioDonut.tsx` | "기타"→"미배정 자산", 색상 변경, 플랜 상태별 표시 |
| `frontend/src/components/dashboard/EmptyChart.tsx` | 신규 컴포넌트 (플랜 없음 상태용) |
| `backend/tests/test_asset_service.py` | 원화 환산 테스트 추가 |

---

*냥~ 스펙 문서 작성 완료! 🐱*
