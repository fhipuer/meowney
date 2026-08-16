# 투자 레짐 v1.5.3 최종 판정·구현 명세

작성일: 2026-08-16  
목적: 조기경보 첫 화면의 동적 판정 가시성, 계산과 표시의 일치, 확장 가능한 정보구조 확정

## 최종 판정

공통 감사 합의는 대부분 타당하며 이번 개선 방향으로 채택한다. 특히 현재 `ThesisPanel`의 고정 3열 `220px / 1fr / 240px` 구조는 기업·제품·산업 영역이 늘어날수록 깨지므로 폐기해야 한다. 성장·물가를 이미 macro 차트와 기여 목록에서 설명하는데 `MonitoringTable`에 다시 넣는 것도 중복이다. 활성 trigger가 변화 inbox, evidence, monitoring에 반복되는 구조 역시 조기경보의 우선순위를 흐린다.

다만 여섯 컴포넌트를 이번 턴에 전면 공용 디자인 시스템으로 만들거나 모든 탭을 재작성하는 것은 과하다. 이번 턴 P0에서는 현재 탭의 구조와 명칭을 안전하게 바꾸고, P1에서는 History와 Indicators의 반복 패턴을 개선한다. 서버 view model, event lifecycle, 산업 전체 IA는 후속 대규모 작업으로 분리한다.

사용자 결정은 그대로 유지한다.

- 다크모드가 기본이다.
- 본문에는 현재 판정과 행동을 쓰고, 방법론·한계는 (?) 도움말에 둔다.
- 별도 외부점검 완료 UI는 만들지 않는다.
- 상태 기록 저장 자체가 당시 활성 경보 확인이다.

## 최종 Current 정보 순서

1. 행동 판정 — 지금 상세점검 / 다음 발표까지 관찰 / 새 상세점검 사유 없음
2. 현재 점검 항목 — 새 변화와 현재 행동을 만든 핵심 근거
3. 미국 거시경제 — 절대상태 점 + 최근 방향 화살표 + 주요 기여
4. 금융 전달 — 정책, 장기금리, 신용
5. AI 인프라 관측범위 — CAPEX 프록시, 공개 DRAM/NAND, 미연결 Server DRAM/HBM
6. 다음 발표 — 우선순위를 낮춘 compact 목록
7. 상태 기록 — 현재 상태와 활성 경보 확인

현재 `UpcomingEvents`가 macro보다 앞에 있는 순서는 변경한다. 일정은 중요한 보조정보지만 현재 행동과 환경보다 앞설 수 없다.

## 이번 턴 P0

### 1. DecisionBanner

기존 `DecisionHeader`를 개념적으로 `DecisionBanner`로 정리한다. 새 파일 분리는 선택 사항이며 DOM·copy 계약이 중요하다.

Anatomy:

- `eyebrow`: `포트폴리오 점검`
- `result`: 가장 큰 동적 결과
- `reason`: 결과를 만든 첫 번째 근거 한 문장
- `context`: 현재 상태와 최근 방향
- `status cells`: 확정 레짐 / 현재 후보 / 자료 상태
- `help`: 확정·후보·자료 상태 정의

정확한 문구:

- required: `지금 상세점검하세요`
- watch: `다음 핵심 발표까지 관찰하세요`
- not_needed: `새 상세점검 사유 없음`
- acknowledged watch: `확인한 경보 유지 · 새 변화 없음`
- 상태: `완만한 확장·물가 높음`
- 방향: `최근 성장 변화 미미·물가 완화`
- 레짐: `확정 경계 · 현재 후보 경계`
- 자료: `핵심지표 34/34`

본문에서 삭제/도움말로 이동:

- `점=현재 수준 · 화살표=최근 상대 방향`
- `미국 거시 전용`
- `예측 정확도나 빈티지 완결도는 아님`

위 정의는 각 label의 (?)에 둔다.

Grid:

- desktop ≥1024: `minmax(360px, 2fr) repeat(3, minmax(120px, 1fr))`
- tablet: 결과 full row + 3개 상태 `grid-cols-3`
- mobile: 결과 full row + 상태 `grid-cols-2`; 자료 상태는 full width 가능
- 좌측 border 반복 대신 status cell에 `rounded-lg bg-muted/25 p-3`

### 2. 현재 점검 항목을 단일 EvidenceList로

활성 trigger의 본문 목록은 이곳에만 둔다. `EvidencePanel`의 trigger 카드와 Monitoring의 trigger 문장을 제거한다.

Anatomy:

- severity badge: `긴급 / 높음 / 변화 / 자료`
- title: 사람이 읽는 근거
- state badge: `새 경보 / 심각도 상승 / 확인됨 / 활성`
- impact: 포트폴리오 점검 의미 한 줄이 있을 때만
- maximum: 첫 화면 3개, 나머지는 `n개 더 보기`

정렬:

1. 새 Critical
2. 새 High 또는 severity 상승
3. 미확인 active Critical/High
4. 기록 이후 영역 변화
5. blocking data gap
6. 이미 확인한 active 경보

현재 API가 trigger lifecycle을 완전히 구분하지 못하는 경우:

- `review_acknowledged=true`인 동일 trigger에는 `확인됨`
- 그 외에는 `활성`
- 근거 없이 `새 경보`라고 표시하지 않는다.

빈 상태 문구: `마지막 상태 기록 이후 새 점검 사유가 없습니다.`

### 3. Macro 영역

`MacroQuadrant`는 유지한다. 오른쪽에는 trigger 중복 카드 대신 `최근 방향을 만든 주요 지표`만 둔다.

구성:

- ChartCard: 현재 절대상태 점, 최근 방향 화살표
- MetricTile 3개: 현재 절대환경 / 최근 방향 / 경제 해석
- EvidenceList: 성장·물가 기여를 각 최대 3개

차트 색:

- 점: 흰색 또는 foreground + primary outline
- 성장 개선: emerald/cyan
- 성장 둔화: blue
- 물가 재가속: amber
- 물가 완화: cyan
- 분면 배경은 저채도 6~10% opacity

빨강은 침체/스태그플레이션 분면 배경이 아니라 `긴급 행동`에만 쓴다.

### 4. 금융 전달 DomainResultCard 3개

`MonitoringTable`에서 성장·고용과 물가 행을 제거한다. 남기는 영역:

- 정책금리
- 장기금리
- 신용여건

desktop: `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`  
mobile: 1열

각 카드 anatomy:

- domain label
- dynamic result: `다소 제한적 / 매우 제한적 / 완화적`
- primary metric
- decomposition/secondary metric
- active count badge만 허용; trigger 본문은 현재 점검 항목에만 존재
- method/source는 MetadataStrip 또는 (?)

예시:

- `정책금리 · 다소 제한적` / `실질 정책금리 +0.34%p`
- `장기금리 · 매우 제한적` / `10Y 4.63% · TIPS 2.39% · BEI 2.27%`
- `신용여건 · 완화적` / `HY 2.71%p · IG 0.79%p · NFCI -0.55`

### 5. AI 관측범위 재구성

기존 `lg:grid-cols-[220px_1fr_240px]`를 제거한다.

섹션 순서:

1. `AI 인프라 관측범위` 헤더
2. Scope matrix
3. 연결된 결과 카드 auto-fit
4. 고정 metadata strip

Scope matrix는 현재 탭에 항상 보인다.

| 영역 | 상태 | 현재 사용 |
| --- | --- | --- |
| 하이퍼스케일러 총 CAPEX | 연결 | AI 투자강도 보조 |
| 공개 DRAM 가격 표본 | 연결/제한 | 가격 방향 보조 |
| 공개 NAND 가격 표본 | 연결/제한 | 가격 방향 보조 |
| Server DRAM | 미연결 | 종합판정 미사용 |
| HBM | 미연결 | 종합판정 미사용 |

필요하면 전력·발전은 `후속 범위`로 한 행 추가할 수 있으나 이번 합의의 필수항목은 Server DRAM과 HBM이다.

연결 결과 grid:

`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`

DomainResultCard 예:

- `하이퍼스케일러 총 CAPEX` / `증가 기업 4/4` / 기업별 YoY compact list
- `공개 DRAM 가격 표본` / 현재 표본상태
- `공개 NAND 가격 표본` / 현재 표본상태

기업 수·제품 수가 늘어도 고정 폭 칼럼을 만들지 않는다. 기업 목록은 내부 `repeat(auto-fit, minmax(140px,1fr))`.

동적/고정 분리:

- 동적 result: 상태, 값, 증감, 관측기간, coverage
- 고정 metadata: SEC/TrendForce, 총 CAPEX 정의, derivation, 표본 범위, 마지막 수집시각
- 고정 method 문장은 본문 아래에 길게 쓰지 않고 `MetadataStrip`과 (?)에 둔다.

문구:

- 제목: `AI 인프라 관측범위`
- CAPEX: `하이퍼스케일러 총 CAPEX 프록시`
- DRAM: `공개 DRAM 가격 표본`
- NAND: `공개 NAND 가격 표본`
- 미연결: `Server DRAM · 자료 미연결`, `HBM · 자료 미연결`
- scope 도움말: `연결 상태는 현재 자동판정에 사용할 수 있는 데이터 범위를 뜻합니다.`

미연결을 위험색으로 칠하지 않는다. slate outline과 `미연결` 텍스트를 쓴다.

### 6. Events 하향

AI 관측범위 다음에 compact `다음 발표`를 둔다.

- 첫 2개만 기본 표시
- `일정 전체 보기`로 확장
- 카드 4개 대형 grid 대신 한 줄 list 또는 2열 compact tiles
- event type / 한국시간 / 영향영역만 본문
- source와 calendar method는 (?)

### 7. Snapshot

현재 단일 의미를 유지한다.

- 제목: `현재 상태 기록`
- 본문: `현재 판정과 원자료를 기록합니다.`
- 도움말: `저장하면 당시 활성 경보도 확인한 것으로 처리합니다. 새 경보 또는 심각도 상승이 생기면 다시 알립니다.`
- 버튼: `현재 상태 기록`
- 별도 외부점검 완료 UI·문구 없음

## 이번 턴 P1

### 1. History badge wall 축소

한 행에 badge를 나열하지 않는다.

History card anatomy:

- header: 기록일시 + `확정 레짐` 하나
- summary: 당시 경제상태 / 최근 방향 / 점검판정
- evidence: 당시 활성 경보 최대 2개 + `n개 더 보기`
- metadata: 기준일, 자료상태, 규칙버전은 접힌 MetadataStrip
- 사용자 판정과 메모는 별도 하단 영역

색 badge는 최대 2개만 동시에 보인다. 나머지 상태는 plain text.

### 2. Indicators 대형 차트 기본 노출 축소

모든 SignalCard가 큰 차트를 기본으로 보여주는 구조를 바꾼다.

- 기본: MetricTile — 이름, 최신값, 핵심 변화, 관측일, 판정사용 badge
- `차트 보기`로 ChartCard 확장
- 중요한 비교차트만 기본 노출: 10Y/TIPS/BEI, 물가 YoY/3M 연율 같은 관계형 차트
- 단일 series는 기본 접힘
- desktop auto-fit: `repeat(auto-fit,minmax(260px,1fr))`
- 기간은 달력기준 `1년/3년/전체`, 모든 카드에 동일 계약

### 3. 여섯 UI primitive의 로컬 적용

이번 턴에는 현재/History/Indicators 안에서 반복되는 markup을 아래 여섯 역할로 정리할 수 있다. 전역 디자인 시스템 승격은 후속 검토한다.

#### DecisionBanner

행동판정과 현재 맥락. 페이지당 1개.

#### DomainResultCard

영역 단위 동적 결과. label/result/primary metric/secondary metric/status.

#### MetricTile

단일 값. label/value/unit/change/date/usage.

#### ChartCard

관계나 추세. title/range/legend/chart/accessible summary.

#### EvidenceList

판정 근거. severity/state/text/impact/source link.

#### MetadataStrip

source/method/as-of/fetched/coverage/rule version. 기본 compact, 상세 접힘 또는 tooltip.

## 색상 계약

다크모드에서 색은 행동 심각도와 방향을 분리한다.

- red: required / critical만
- amber: watch / high / 물가 상승압력
- emerald: 안정·개선·정상 수집
- cyan/blue: 정보, 완화방향, 차트 primary
- violet: AI/산업 범주 식별용으로만 사용 가능
- slate: 미연결·미수집·metadata

`완화적`을 항상 초록, `제한적`을 항상 빨강으로 칠하지 않는다. 금융상태는 현재 포트폴리오에 따라 효용이 달라지므로 상태 텍스트는 중립색, 경보가 발생했을 때만 severity 색을 쓴다.

색만으로 의미를 전달하지 않는다. 모든 badge에 텍스트가 있어야 한다.

## 후속 대규모 IA·데이터 작업

이번 턴에 포함하지 않는다.

1. 백엔드가 DecisionBanner/Scope/ChangeInbox용 완성 view model을 직접 반환하는 작업.
2. trigger의 fired/severity_up/resolved/acknowledged lifecycle 저장.
3. Snapshot 간 수치·근거 diff.
4. fiscal/calendar aligned CAPEX와 AI 귀속 데이터.
5. Server DRAM/HBM/NAND 대표성 있는 공급자와 schema.
6. AI→기업 기여→반도체·메모리→전력 downstream IA.
7. History timeline/compare 전용 페이지.
8. 여섯 primitive를 앱 전역 디자인 시스템으로 승격.
9. 접근성 자동검사와 색각·키보드·스크린리더 전체 감사.

## 기각·조정한 제안

- Events를 제거하는 제안은 기각한다. 발표일 누락 방지가 제품 목적이므로 순위만 낮춘다.
- HBM·Server DRAM 미연결을 빈 카드 여러 개로 크게 강조하는 것은 과하다. scope matrix에 항상 보이되 동적 결과 카드와 동일 크기를 주지 않는다.
- 모든 현재 카드에 source/method를 본문으로 표시하는 제안은 기각한다. MetadataStrip과 (?)로 분리한다.
- 여섯 컴포넌트를 이번 턴에 전역 추상화하는 것은 기각한다. 현재 화면에서 패턴을 검증한 뒤 승격한다.
- 활성 trigger를 모든 영역 카드에 반복 설명하는 것은 기각한다. EvidenceList 한 곳에 본문을 두고 다른 곳은 count만 둔다.
- Snapshot과 경보 확인을 다시 분리하는 제안은 사용자 결정과 충돌하므로 기각한다.

## P0 수용 기준

1. Current DOM 순서가 행동→점검항목→macro→금융전달→AI 관측범위→events→snapshot이다.
2. 동일 trigger summary가 첫 화면에 두 번 이상 나타나지 않는다.
3. 금융전달 영역에 성장·물가 카드/행이 없다.
4. `ThesisPanel`에 고정 `220px/1fr/240px` grid가 없다.
5. CAPEX 기업과 가격 제품 수가 늘어도 auto-fit으로 줄바꿈되고 가로 overflow가 없다.
6. Server DRAM과 HBM의 `미연결` 상태가 Current scope matrix에 항상 표시된다.
7. 동적 결과와 method/source metadata가 같은 본문 paragraph에 섞이지 않는다.
8. Events가 AI 관측범위 뒤에 위치하고 기본 2개만 보인다.
9. red는 required/critical 외 상태에 사용되지 않는다.
10. Snapshot 저장 도움말이 경보 확인의 단일 의미를 설명하고 외부점검 완료 UI가 없다.
11. 390px 화면에서 모든 P0 섹션이 수평 스크롤 없이 읽힌다.

## P1 수용 기준

1. History 카드의 동시 badge가 2개 이하이며 당시 환경·방향·경보가 텍스트로 보인다.
2. 단일 지표 대형 차트는 기본 접혀 있고 최신값은 차트 없이 읽을 수 있다.
3. 기본 노출 차트는 두 시계열 이상의 관계를 설명하거나 핵심 비교 목적이 있다.
4. 지표 차트 기간 선택은 1년/3년/전체로 통일된다.
5. 여섯 primitive 역할별 필수 field가 누락되지 않는다.
6. tooltip 없이도 동적 판정과 행동은 이해할 수 있고, tooltip에서 방법론·source·한계를 확인할 수 있다.

## 최종 한 문장

v1.5.3의 다음 안전한 개선은 데이터를 더 많이 보여주는 것이 아니라, **행동과 동적 결과를 먼저 한 번만 보여주고, 고정 방법론과 미연결 범위를 별도 층으로 정리하는 것**이다.
