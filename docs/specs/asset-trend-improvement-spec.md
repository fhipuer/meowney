# 자산 추이 기능 개선 스펙 (v0.6.0)

## 1. 개요

### 1.1 배경 및 목적
현재 자산 추이 차트는 30일 고정 기간만 지원하며, 벤치마크 비교 기능이 없어 투자 성과를 객관적으로 평가하기 어렵습니다. 또한 과거 데이터 입력이 불가능하여 서비스 사용 이전의 투자 기록을 반영할 수 없습니다.

### 1.2 핵심 가치 제안
- **다양한 조회 기간**: 1주~1년까지 원하는 기간의 자산 추이 확인
- **벤치마크 비교**: KOSPI, S&P 500, NASDAQ과 내 포트폴리오 수익률 비교
- **과거 데이터 입력**: 서비스 사용 이전의 투자 기록 수동 입력
- **개선된 시각화**: 손익 영역 색상 구분, 직관적인 기간 선택 UI

---

## 2. 요구사항

### 2.1 기능 요구사항

#### FR-1: 조회 기간 선택
- **FR-1.1**: 1W(1주), 1M(1개월), 3M(3개월), 6M(6개월), 1Y(1년) 기간 선택 버튼 제공
- **FR-1.2**: 차트 상단에 버튼 그룹으로 표시
- **FR-1.3**: 기본값은 1M (1개월)
- **FR-1.4**: 선택된 기간에 따라 X축 레이블 자동 조정
  - 1W: 일별 (MM/DD)
  - 1M: 일별 (MM/DD)
  - 3M+: 주별 또는 월별

#### FR-2: 벤치마크 비교
- **FR-2.1**: KOSPI, S&P 500, NASDAQ 벤치마크 지원
- **FR-2.2**: 동일 차트에 오버레이 방식으로 표시
- **FR-2.3**: 조회 기간 시작일을 기준(0%)으로 상대 수익률 비교
- **FR-2.4**: 범례에 각 벤치마크 ON/OFF 토글 제공
- **FR-2.5**: 기본값: 모든 벤치마크 OFF

#### FR-3: 벤치마크 데이터 저장
- **FR-3.1**: 기존 스케줄러(23:00)에서 asset_history와 함께 벤치마크 데이터 수집
- **FR-3.2**: 별도 테이블 `benchmark_history`에 일별 종가 저장
- **FR-3.3**: 저장 항목: ticker, date, close_price

#### FR-4: 과거 데이터 수동 입력
- **FR-4.1**: 설정 페이지 내 "과거 데이터 관리" 섹션 추가
- **FR-4.2**: 입력 필드: 날짜, 총자산, 투자원금 (3개)
- **FR-4.3**: 다중 행 입력 지원 (한 번에 여러 날짜 입력)
- **FR-4.4**: 기존 데이터 조회/수정/삭제 기능

#### FR-5: 시각화 개선
- **FR-5.1**: 투자원금 대비 수익/손실 영역 색상 구분
  - 총자산 > 투자원금: 빨간색(수익) 영역
  - 총자산 < 투자원금: 파란색(손실) 영역
- **FR-5.2**: 기간 선택 버튼 UI (차트 상단 버튼 그룹)
- **FR-5.3**: 데이터 없는 구간 선형 보간 처리

### 2.2 비기능 요구사항

#### NFR-1: 성능
- 차트 로딩 시간 2초 이내
- 벤치마크 데이터 캐싱으로 API 호출 최소화

#### NFR-2: 데이터 정합성
- 과거 데이터 입력 시 기본 유효성 검증
  - 날짜 형식 검증
  - 숫자 필드 음수 허용 안함 (단, 총자산 < 투자원금은 허용 - 투자 손실 상황)
  - 필수값 체크
- 중복 날짜 시 덮어쓰기 또는 경고

---

## 3. 사용자 시나리오

### 시나리오 1: 장기 투자 성과 확인
1. 사용자가 대시보드의 자산 추이 차트에 접근
2. 기간 선택 버튼에서 "1Y" 클릭
3. 1년간의 자산 추이가 차트에 표시됨
4. 투자원금 대비 수익 구간은 빨간색, 손실 구간은 파란색으로 표시

### 시나리오 2: 벤치마크 비교
1. 자산 추이 차트에서 기간 "6M" 선택
2. 범례에서 "S&P 500" 토글 ON
3. 내 포트폴리오 수익률과 S&P 500 수익률이 오버레이로 표시
4. 6개월 전을 기준(0%)으로 상대 수익률 비교

### 시나리오 3: 과거 데이터 입력
1. 설정 > 과거 데이터 관리 메뉴 접근
2. "새 데이터 추가" 클릭
3. 날짜: 2025-01-01, 총자산: 50,000,000, 투자원금: 45,000,000 입력
4. 저장 후 자산 추이 차트에 해당 데이터 반영

---

## 4. 기술 설계

### 4.1 데이터베이스 스키마

```sql
-- 벤치마크 히스토리 테이블
CREATE TABLE benchmark_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) NOT NULL,        -- '^KS11', '^GSPC', '^IXIC'
    snapshot_date DATE NOT NULL,
    close_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(ticker, snapshot_date)
);

CREATE INDEX idx_benchmark_history_ticker_date ON benchmark_history(ticker, snapshot_date);
```

### 4.2 API 설계

#### GET /api/v1/dashboard/history
기존 API 확장:
```
Query Parameters:
- portfolio_id: UUID (optional)
- period: string (1W, 1M, 3M, 6M, 1Y) - NEW
- start_date: date (optional, period 대신 직접 지정 시)
- end_date: date (optional)
```

#### GET /api/v1/dashboard/benchmark-history
새 API:
```
Query Parameters:
- tickers: string[] (예: "^KS11,^GSPC,^IXIC")
- period: string (1W, 1M, 3M, 6M, 1Y)
- start_date: date (optional)
- end_date: date (optional)

Response:
{
  "data": {
    "^KS11": [{ "date": "2025-01-01", "close": 2500.00, "return_rate": 0 }, ...],
    "^GSPC": [{ "date": "2025-01-01", "close": 4500.00, "return_rate": 0 }, ...],
    ...
  }
}
```

#### POST /api/v1/asset-history/manual
과거 데이터 수동 입력:
```
Request Body:
{
  "entries": [
    {
      "snapshot_date": "2025-01-01",
      "total_value": 50000000,
      "total_principal": 45000000
    }
  ]
}
```

#### GET /api/v1/asset-history/manual
과거 데이터 조회

#### DELETE /api/v1/asset-history/{id}
과거 데이터 삭제

### 4.3 프론트엔드 컴포넌트 구조

```
AssetTrendChart/
├── PeriodSelector.tsx      # 기간 선택 버튼 그룹
├── BenchmarkLegend.tsx     # 벤치마크 ON/OFF 토글 범례
├── TrendAreaChart.tsx      # 손익 영역 색상 구분 차트
└── index.tsx               # 메인 컴포넌트

SettingsPage/
└── PastDataSection/
    ├── PastDataForm.tsx    # 과거 데이터 입력 폼
    └── PastDataTable.tsx   # 기존 데이터 목록/수정/삭제
```

### 4.4 스케줄러 수정

```python
async def take_daily_snapshot():
    # 기존: asset_history 저장
    # 추가: benchmark_history 저장

    benchmarks = ['^KS11', '^GSPC', '^IXIC']
    for ticker in benchmarks:
        price = await finance_service.get_ticker_close(ticker)
        await save_benchmark_history(ticker, today, price)
```

---

## 5. UI/UX 설계

### 5.1 자산 추이 차트 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ 자산 추이                         +₩1,234,567 (+2.5%)│
│                                                     │
│ [1W] [1M] [3M] [6M] [1Y]                           │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │        ████████████████████                     │ │ <- 수익 영역 (빨간)
│ │   ─────────────────────────────────             │ │ <- 투자원금 선
│ │ ████████                                        │ │ <- 손실 영역 (파란)
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ─ 총 자산  ┄┄ 투자원금  ─ KOSPI  ─ S&P500  ─ NASDAQ │
│              [■] KOSPI  [□] S&P500  [□] NASDAQ     │
└─────────────────────────────────────────────────────┘
```

### 5.2 기간 선택 버튼 스타일
- 버튼 그룹 형태 (연결된 버튼)
- 선택된 버튼: primary 색상 배경
- 미선택 버튼: ghost 스타일

### 5.3 손익 영역 색상
- 수익 영역: `rgba(239, 68, 68, 0.2)` (빨간색 20% 투명도)
- 손실 영역: `rgba(59, 130, 246, 0.2)` (파란색 20% 투명도)
- 투자원금 선: 점선 (기존 유지)

---

## 6. 보안 고려사항

- 과거 데이터 입력 시 현재 사용자의 portfolio_id만 수정 가능
- API rate limiting 적용 (과도한 데이터 입력 방지)
- 입력 데이터 sanitization (XSS 방지)

---

## 7. 테스트 계획

### 7.1 백엔드 단위 테스트
- [ ] 벤치마크 데이터 저장/조회 테스트
- [ ] 기간별 데이터 필터링 테스트
- [ ] 데이터 보간 로직 테스트
- [ ] 과거 데이터 CRUD 테스트
- [ ] 유효성 검증 테스트

### 7.2 Playwright UI 테스트
- [ ] 기간 선택 버튼 동작 테스트
- [ ] 벤치마크 토글 ON/OFF 테스트
- [ ] 차트 렌더링 테스트 (각 기간별)
- [ ] 과거 데이터 입력 폼 테스트
- [ ] 손익 영역 색상 표시 테스트

---

## 8. 제약사항 및 가정

### 8.1 제약사항
- yfinance API 호출 제한으로 실시간 벤치마크 조회 불가 → 일별 스냅샷 사용
- 과거 데이터 입력 시 개별 자산 스냅샷은 지원하지 않음 (총자산/원금만)

### 8.2 가정
- 사용자는 정확한 과거 데이터를 입력한다고 가정
- 벤치마크 데이터는 KRX/US 거래일 기준으로 존재
- 휴일/주말 데이터는 이전 거래일 값으로 보간

---

## 9. 미결정 사항 / 추후 논의 필요

1. **벤치마크 커스텀 추가**: 사용자가 원하는 ETF/지수 추가 가능 여부 → v0.7.0 이후
2. **CSV 일괄 업로드**: 과거 데이터 CSV 파일로 일괄 입력 → 필요 시 추가
3. **수익률 계산 방식**: 단순 수익률 vs XIRR(시간가중수익률) → 현재는 단순 수익률

---

## 10. 구현 체크리스트

### Phase 1: 데이터베이스 및 백엔드
- [ ] `benchmark_history` 테이블 생성
- [ ] 스케줄러에 벤치마크 수집 로직 추가
- [ ] `/api/v1/dashboard/history` 기간 파라미터 추가
- [ ] `/api/v1/dashboard/benchmark-history` API 구현
- [ ] `/api/v1/asset-history/manual` CRUD API 구현
- [ ] 데이터 보간 로직 구현

### Phase 2: 프론트엔드 차트 개선
- [ ] PeriodSelector 컴포넌트 구현
- [ ] 기간별 데이터 조회 훅 수정
- [ ] 손익 영역 색상 구분 차트 구현
- [ ] X축 레이블 자동 조정

### Phase 3: 벤치마크 비교
- [ ] BenchmarkLegend 컴포넌트 구현
- [ ] 벤치마크 데이터 조회 훅 구현
- [ ] 차트에 벤치마크 오버레이 추가
- [ ] 상대 수익률 계산 로직

### Phase 4: 과거 데이터 입력
- [ ] 설정 페이지 과거 데이터 섹션 UI
- [ ] 입력 폼 유효성 검증
- [ ] 데이터 목록/수정/삭제 UI

### Phase 5: 테스트 및 검증
- [ ] 백엔드 단위 테스트
- [ ] Playwright UI 테스트
- [ ] 통합 테스트
