# 투자 레짐 조기경보 다음 구현 명세 v0.1

> 구현 상태 (2026-08-16): P1.5 1차 구현 완료. `required/watch/not_needed`, 초기 물가·금리·고용·신용·시장
> trigger, freshness/coverage, 10Y 20관측일 분해, Snapshot 동결 필드와 점검 완료 acknowledgment를 반영했다.
> 발표 일정, 데이터 vintage/revision, 63일 금리 분해, AI·반도체·전력 sentinel은 후속 단계다.

## 1. 목표

레짐 탭은 다음 질문에 우선 답한다.

> 지금 외부 ChatGPT 포트폴리오 상세 점검 프롬프트를 실행해야 하는가?

정밀 자산배분 판단 자체는 외부 분석에 맡긴다. 앱은 최신 데이터 변화, 임계치 통과, 발표 이벤트와
데이터 공백을 결정론적으로 감지해 상세 점검의 실행 시점을 놓치지 않게 한다.

## 2. 서로 독립적인 상태

### 환경 상태

- `confirmed_regime`: 유지 / 경계 / 약화 / 전환
- `candidate_regime`: 현재 데이터로 계산한 후보 상태
- 거시 레짐과 핵심 투자 가설 레짐을 분리한다.
- 레짐 변경에는 지표별 observation sequence 기반 hysteresis를 적용한다.

### 상세 점검 필요도

저장값과 표시 문구는 다음과 같다.

| 저장값 | 표시 | 의미 |
| --- | --- | --- |
| `required` | 지금 상세 점검 | 외부 분석을 지금 실행할 근거가 충분함 |
| `watch` | 관찰 | 후보 악화 또는 단일 고위험 신호가 있어 다음 발표 확인 필요 |
| `not_needed` | 점검 불필요 | 마지막 점검 이후 의미 있는 신규 변화 없음 |

점검 필요도는 충격에 즉시 반응하며 레짐 hysteresis를 기다리지 않는다. 어떤 상태도 주문이나 비중을
자동 변경하지 않는다.

## 3. 점검 필요도 규칙

### `required`

다음 중 하나를 충족한다.

1. confirmed regime이 변경됨
2. candidate regime이 약화 또는 전환
3. Critical trigger 1개 발생
4. 서로 다른 evidence cluster의 High trigger 2개가 10영업일 내 발생
5. 공식 Snapshot 이후 핵심 영역 2개 이상이 한 단계 악화
6. 핵심 4영역 중 2개 이상이 데이터 부족으로 판정 불가

6번은 위험 악화가 아니라 `판단 불가로 인한 점검 필요`라고 설명한다.

### `watch`

다음 중 하나를 충족한다.

1. candidate가 confirmed보다 한 단계 악화했으나 미확정
2. High trigger 1개
3. Medium trigger 2개
4. 72시간 이내 핵심 발표가 있고 해당 영역이 중립 이하
5. 핵심 데이터가 권장 freshness를 초과

그 외는 `not_needed`다. 우선순위는 required > watch > not_needed다. 악화와 회복 trigger를
상계하지 않고 별도로 표시한다.

## 4. 초기 Trigger 카탈로그

모든 임계값은 rule ID/version이 있는 설정 객체 또는 DB 정의로 관리한다.

### 긴축·인플레이션

- Critical: Core CPI 또는 Core PCE 3M 연율 `>=4.0%`이면서 직전 3M 연율 대비 `>=1.0%p`
- Critical: 10Y 실질금리 20영업일 `+50bp`
- High: Core CPI/Core PCE 3M 연율 `>=3.0%`가 동일 지표 2회 연속
- High: BEI 20영업일 `+30bp`와 명목 10Y `+50bp` 동시
- Fed 기대경로의 예상 밖 상향은 데이터 확보 전 미구현으로 표시

10Y 변화는 TIPS와 BEI 변화로 분해한다. 20일과 63일 구간에서 절대 기여가 큰 성분을
`실질금리 주도 / 기대인플레이션 주도 / 혼합`으로 분류하고 잔차를 표시한다.

### 침체·성장

- Critical: Sahm rule 실시간 값 `>=0.50%p`
- Critical: HY OAS 10영업일 `+150bp`와 신규실업수당 4주평균 YoY `+20%` 동시
- High: 실업률 3개월 평균이 12개월 저점보다 `+0.30%p`
- Required 승격: 위 차이가 `+0.50%p`
- High: 신규실업수당 4주평균 YoY `+15%`가 2회 연속
- High: 산업생산 3M 연율 음수와 실질 소매판매 둔화 동시
- GDP는 확인 신호이며 단독 Critical로 쓰지 않는다.

### 신용·유동성

- Critical: HY OAS `>=5%p` 또는 10영업일 `+150bp`
- Critical: NFCI `>=0.5`
- High: HY OAS `>=4%p` 또는 20영업일 `+75bp`
- High: IG OAS `>=1.5%p`
- High: NFCI `>=0`가 2주 연속
- Fed balance, reserve, RRP는 맥락 보조 신호이며 단독 required로 쓰지 않는다.

### 시장 충격

- High: VIX `>=30` 또는 5영업일 `+12pt`
- High: S&P500 또는 NASDAQ 20영업일 `-10%`
- High: USD/KRW 20영업일 `+7%`
- 가격 신호 단독으로 confirmed regime을 전환하지 않고 상세 점검만 촉구한다.

### AI 투자 최소 Sentinel — 후속 단계

- Critical: MSFT/Alphabet/Meta/Amazon 중 2개 이상이 같은 실적 시즌에 CAPEX 절대액 가이던스 하향
- High: 합산 TTM CAPEX YoY가 2분기 연속 둔화하고 마지막 분기 절대액도 QoQ 감소
- 증가율 둔화만으로 투자 사이클 종료를 판단하지 않는다.
- SEC XBRL 원자료, 회계기간, 발표일, revision을 저장한다.

### 반도체·메모리 최소 Sentinel — 후속 단계

- Critical: 가격 하락+재고 증가 또는 복수 기업 가이던스 하향이 2개 발표주기 지속
- High: 메모리 가격 방향 전환 또는 주요 기업 2곳의 이익/출하 가이던스 하향
- 단일 기업 사건은 산업 trigger로 승격하지 않는다.
- SNDK/NAND, 한국 반도체, SMH 노출을 구분한다.

### 전력망·발전 최소 Sentinel — 후속 단계

- Critical: orders/backlog 감소가 복수 기업 또는 2분기 연속이며 프로젝트 취소 증거 동반
- High: lead time 급락과 수주 성장 둔화 또는 복수 대형 프로젝트 지연
- 송배전 장비, 발전설비, 발전사업자를 별도 하위영역으로 유지한다.

## 5. 데이터 모델

### 관측값 확장

`regime_observations` 또는 별도 vintage 테이블에 다음을 저장한다.

- observation_date
- release_at
- fetched_at
- realtime_start/vintage
- value
- previous_value
- revision
- consensus 및 surprise(확보 가능한 경우)
- source_url
- quality/status

### `regime_events`

- event_type
- scheduled_at / released_at
- importance
- affected_domains
- result/severity
- trigger_ids

### `regime_triggers`

- rule_id / rule_version
- first_fired_at / last_fired_at
- severity / direction
- evidence_cluster
- evidence_json
- active / resolved
- resolution_reason

### `review_assessments`

- urgency
- reasons
- blockers/data_gaps
- based_on_evaluation_id
- since_snapshot_id
- rule_version

과거 Snapshot은 당시 vintage와 rule version을 고정한다. 최신 데이터 revision이 과거 Snapshot을
변경해서는 안 된다.

## 6. UI

### 최상단 Hero

가장 크게 `상세 점검: 지금 실행 / 관찰 / 불필요`를 표시한다. 옆에 macro confirmed/candidate와
thesis regime coverage를 표시한다.

- required CTA: `분석 데이터 내보내기`
- watch CTA: `관찰 근거 보기`
- not_needed: `마지막 점검 이후 신규 중요 변화 없음`

### 왜 지금?

중요도 순 최대 3개를 다음 형식으로 표시한다.

`[중요도] 무엇이 / 언제 / 기준보다 얼마나 / 어느 영역과 자산에 영향`

예: `긴축 High · Core CPI 3M 연율 4.2%, 직전 대비 +1.1%p · 장기채/성장주 재점검`

### 다음 확인 이벤트

- 발표명
- 한국시간
- 예정 / 발표 / 수집 실패 상태
- 영향을 받을 trigger와 영역

### 영역 카드

- 상태
- 개선 / 변화 없음 / 악화 방향
- confidence와 coverage
- 최신 핵심 관측일
- 다음 발표
- active trigger 수

데이터 부족은 중립로 표시하지 않고 `미확인 / 오래됨 / 수집 실패`로 구분한다.

### 상세 지표

- 기본 정렬은 지표 목록이 아니라 `새로 변한 것` 우선
- 관측 기준일과 수집시각을 분리 표시
- latest YoY, 3M annualized, 직전 발표 대비를 지표 성격에 맞게 표시
- 일별·월별·분기별 차트 기간을 명시적으로 통일
- 명목 10Y/TIPS/BEI는 같은 차트와 성분 기여 카드로 표시

### 메인 대시보드

- 상세 점검 필요도
- 신규 active trigger 수
- 가장 중요한 신규 변화 1개
- 다음 핵심 발표

## 7. Snapshot과 History

Snapshot은 계속 사용자 버튼으로만 생성한다. 추가 저장 항목은 다음과 같다.

- review urgency
- active trigger 및 rule version
- event 상태
- data vintage/freshness/coverage
- confirmed/candidate macro regime
- thesis regime 또는 미확인 상태

History 기본 열:

`날짜 | 점검 필요도 | 자동/사용자 레짐 | 신규/해소 trigger | 주요 변화`

Snapshot 비교는 모든 수치보다 상태 변경, 임계치 통과, trigger 발생/해소와 revision을 우선한다.

## 8. 설명 가능성

- 모든 판단 사유에 rule ID/version, 실제값, 비교기준, 기간, source와 관측일 포함
- 내부 점수만 사용자에게 노출하지 않음
- 임계치까지 남은 margin을 표시
- CPI/Core CPI/Core PCE는 inflation cluster로 묶어 독립 신호로 과대계상하지 않음
- HY/IG OAS는 credit cluster로 묶음
- required의 독립 High 2개는 서로 다른 evidence cluster여야 함

## 9. 수용 기준

1. 같은 raw data와 rule version은 같은 레짐, urgency와 사유 순서를 반환한다.
2. 같은 관측을 여러 번 refresh해도 persistence가 증가하지 않는다.
3. 무관 지표 갱신은 다른 signal의 hysteresis를 확정하지 않는다.
4. Core CPI Critical 충격은 confirmed regime이 유지여도 `required`를 반환한다.
5. candidate 경계 1회는 `watch`, 같은 지표의 다음 관측 재확인 후 레짐을 재평가한다.
6. stale 핵심 데이터는 중립로 계산되지 않고 coverage/confidence를 낮춘다.
7. 10Y 상승에서 TIPS 기여가 크면 실질금리 주도, BEI가 크면 기대인플레이션 주도로 분류한다.
8. 관측 revision 이후에도 기존 Snapshot JSON과 판단 사유는 변하지 않는다.
9. trigger 해소 조건과 사용자의 상세 점검 완료 상태를 각각 테스트한다.
10. AI·반도체·전력이 미구현이면 thesis regime을 유지로 표시하지 않고 미확인으로 표시한다.

## 10. 구현 순서

### P1.5

review urgency, trigger/event 스키마, 긴축·침체·신용·시장 trigger, 10Y 분해, 다음 발표 UI,
Snapshot 확장

### P2

SEC XBRL 기반 hyperscaler CAPEX와 AI 영역

### P2.5

반도체 공개 재무/가이던스 signal, KOSIS 반도체 수출. 신뢰 가능한 자동 출처가 없는 산업 가격과
재고는 `미확인` 유지

### P3

EIA 전력 데이터와 전력 기업 공시 기반 orders/backlog

## 11. 미결정 제품 항목

사용자가 외부 ChatGPT 상세 점검을 실행한 사실을 앱에 기록할지 결정해야 한다.

- 기록하지 않으면 Critical trigger가 지속되는 동안 계속 `지금 상세 점검`을 표시한다.
- 기록하면 `상세 점검 완료` 버튼과 실행일을 저장하고, 이후 신규 변화가 없을 때 반복 촉구를 억제한다.
- 외부 분석 본문을 저장할 필요는 없으며 선택 메모 또는 파일명만 둘 수 있다.
