# 투자 레짐 Phase 1 구현 기준

## 범위

- `/regime` 독립 탭의 현재 상태, 지표, History
- 사용자가 누르는 공식 Snapshot만 지원하며 자동 Snapshot은 만들지 않는다.
- 자동 레짐과 사용자 판정은 별도 필드로 보존한다.
- 자동 판정은 포트폴리오 비중 또는 주문을 변경하지 않는다.
- AI CAPEX, 반도체·메모리, 전력망은 Phase 2~3 범위다.

## 캐시 구조

- `regime_indicators`: 지표와 공급자 식별자, 주기, 방향, 가중치
- `regime_observations`: `value / observation_date / fetched_at / source`
- `regime_fetch_runs`: 공급자별 수집 성공·실패와 저장 건수
- `regime_evaluations`: 데이터 지문, 후보/확정 레짐, signal과 판정 사유
- `regime_snapshots`: raw data, signal, 영역 상태, 실제 포트폴리오와 목표 플랜

화면 요청은 외부 API를 직접 호출하지 않고 SQLite 캐시만 읽는다. 예약 작업과 사용자의
`데이터 새로고침`만 공급자를 호출한다. 실패하면 기존 캐시를 보존한다.

## 초기 결정론적 규칙

규칙은 `backend/app/services/regime_service.py`의 `_score`에 집중시킨다.

- 실업률: 3개월 `+0.15%p`부터 둔화, `+0.30%p`부터 약화
- 신규실업수당: 3개월 `+7%`부터 둔화, `+15%`부터 약화
- CPI/PCE/PPI/임금: 3개월 연율 `3%`부터 둔화, `4%`부터 약화
- HY OAS: `4%p`부터 둔화, `5%p`부터 약화
- IG OAS: `1.2%p`부터 둔화, `1.5%p`부터 약화
- NFCI: `0`부터 둔화, `0.5`부터 약화
- 10Y/TIPS/BEI/Term Premium/Fed Funds: 3개월 `+0.25%p`부터 둔화
- 성장·유동성 수준 지표: 12개월 변화율을 사용한다.

영역별로 지표 중요도가 다르므로 단순 긍정/부정 개수를 세지 않고 가중 연속 점수를 쓴다.
영역 점수와 약화 영역 수를 조합해 후보 레짐을 만든다. 서로 다른 데이터 지문에서 같은 후보가
2회 연속 확인되어야 확정 상태를 변경하며, 같은 데이터 재평가는 기존 평가를 그대로 반환한다.

이 임계값은 검토 가능한 초기안이다. 실제 관측 분포와 Snapshot 이력을 본 뒤 변경할 수 있으며,
변경할 때는 테스트와 이 문서를 함께 갱신한다.

## 자동 데이터

Phase 1은 FRED 한 개 키로 미국 성장·고용, 물가, 국채/TIPS/BEI, 신용·유동성, 주요 시장지수와
한국 GDP·수출·산업생산을 수집한다. 금·은은 동일한 yfinance 선물 종가 시계열로 캐시하고 금은비는
같은 관측일의 두 캐시 값으로 파생한다. 세 지표는 실제 보유 귀금속의 방어·산업수요 맥락을 설명하지만
자동 거시 레짐에는 투표하지 않는다. 무료 PER 자동값은 정의와 결측 문제가 있어 비활성화 상태다.
한국 실업률과 반도체 수출은 KOSIS 통계표 매핑을 검증한 뒤 추가한다.

## 수동 입력 후보(현재 미구현)

- DRAM/HBM/NAND contract price, inventory, bit supply-demand
- 변압기 lead time
- GE Vernova/Eaton/ABB/Schneider/Quanta Orders 및 Backlog
- 데이터센터 grid connection 상태
- 공개 API로 안정적으로 확보하기 어려운 경영진 정성 가이던스

추후 구현할 경우 값, 기준일, 입력시각, 출처 URL과 수정 이력을 필수 저장한다.
