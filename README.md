# Meowney (먀우니) 🐱💰

> 개인 자산 포트폴리오, 일별 자산 추이와 리밸런싱을 한곳에서 관리하는 대시보드

**버전**: 1.13.0

## 주요 기능

- 총자산, 수익률, 환율과 시장 지표 대시보드
- 국내·해외 주식, ETF, 현금 등 자산 관리와 실시간 시세 조회
- 일별 자산 스냅샷 및 기간별 추이 차트
- 목표 비율과 5/25 밴드 기반 리밸런싱 제안
- 개별 자산 및 그룹 배분 플랜
- 과거 자산 데이터 수동 입력
- 자산배분 가이드, 추천 포트폴리오와 투자 성향 퀴즈
- 자산·플랜 데이터 JSON 가져오기/내보내기
- FRED 기반 미국 주요 거시 발표 일정과 SEC XBRL 기반 4개사 AI CAPEX 캐시·판정
- TrendForce 공개 DRAM Contract·Spot 가격 저빈도 캐시와 메모리 가격 사이클
- KOSIS·관세청·OpenDART 기반 한국 반도체 수요·공급·기업 확인 판정
- EIA 기반 미국 전력판매·발전량·설비용량 캐시와 전력 수요 맥락

## 아키텍처

```text
Browser
  └─ Nginx / React
       └─ FastAPI
            ├─ SQLite: 포트폴리오와 히스토리
            ├─ FRED / U.S. Treasury / yfinance: 거시·금리·시장 데이터 수집
            ├─ KOSIS / 관세청 / OpenDART: 반도체 수요·공급·공시
            ├─ EIA: 전력 수요·발전·설비용량
            ├─ SQLite: 원자료·수집상태·레짐 관측값 캐시
            └─ APScheduler: 일일 스냅샷
```

운영 DB는 NAS 영구 볼륨의 `data/meowney.db`입니다. 코드와 DB 마이그레이션만 Git으로
관리하며 `.env`, DB와 백업 파일은 커밋하지 않습니다. SQLite는 WAL 모드로 실행되고,
배포 전 online backup과 순차 마이그레이션을 수행합니다.

## 기술 스택

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts
- Backend: Python 3.11+, FastAPI, Pydantic, yfinance, APScheduler
- Database: SQLite, SQL migration runner
- Deployment: Docker Compose, Synology NAS

## 로컬 개발

### 환경 설정

```powershell
Copy-Item .env.example .env
```

일반 실행에는 Supabase 설정이 필요하지 않습니다. `SUPABASE_URL`과
`SUPABASE_ANON_KEY`는 기존 Supabase 데이터를 최초 이관할 때만 사용합니다.

### 백엔드

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

SQLite DB가 없으면 `backend/data/meowney.db`가 생성되고 기본 포트폴리오·카테고리·설정이
자동으로 준비됩니다.

### 프론트엔드

```powershell
cd frontend
npm ci
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API 문서: `DEBUG=true`일 때 http://localhost:8000/docs

## Docker 실행

```powershell
docker compose up -d --build
docker compose ps
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

컨테이너를 교체해도 루트의 `data/`와 `backups/`는 유지됩니다.

## 기존 Supabase 데이터 이관

저장소 루트 `.env`에 Supabase URL과 anon key를 설정한 후 실행합니다.

```powershell
python backend/scripts/migrate_supabase.py all `
  --output backups/supabase-backup-initial.json `
  --database-url sqlite:///./data/meowney.db
```

이관 도구는 Supabase를 읽기만 하고, 전체 JSON 백업을 만든 뒤 테이블별 레코드 수를
검증하며 SQLite에 복원합니다. 자세한 내용은 [로컬 DB 운영 가이드](docs/local-database.md)를
참고하세요.

## 테스트와 빌드

```powershell
cd backend
python -m pytest -q

cd ../frontend
npm ci
npm run build
```

## NAS 운영 배포

운영 환경은 Synology DS220+이며 소스 아카이브를 SSH로 전송한 뒤 NAS에서 이미지를
빌드합니다. 기본 브랜치는 `main`입니다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1
```

배포 스크립트는 `main` 및 clean worktree 확인, DB·코드 백업, SHA-256 검증, 이미지 빌드,
DB 마이그레이션, 컨테이너 교체와 health check를 수행합니다. 운영 배포 전에는 반드시
[NAS 운영 배포 런북](deploy/NAS_RUNBOOK.md)을 확인하세요.

## 데이터 백업

```powershell
docker compose run --rm meowney-backend python scripts/backup_sqlite.py `
  --source /data/meowney.db `
  --destination /backups/meowney-manual.db
```

NAS 내부 백업만으로는 장치 고장에 대비할 수 없으므로 `backups/`를 다른 장치나
클라우드에도 주기적으로 복제하는 것을 권장합니다.

## 프로젝트 문서

- [NAS 운영 배포 런북](deploy/NAS_RUNBOOK.md)
- [SQLite 운영 및 Supabase 이관](docs/local-database.md)
- [기능 명세](docs/FEATURE_SPEC.md)
- [디자인 가이드](DESIGN.md)

## v1.13.0 주요 변경

- 플랜별 `AI 포트폴리오 점검 문서`에 거시·금리·신용·시장·AI CAPEX·메모리·전력의 핵심 정량 근거를 통합
- 정량 근거마다 관측일·수집일·출처와 데이터 공백을 함께 기록하고 전체 시계열·원자료 덤프는 제외
- 선택한 플랜의 실제 포트폴리오·목표 비중·사용자 지침과 정량 레짐 데이터를 하나의 문서에서 순서대로 제공
- 용도가 겹치고 포트폴리오 문맥이 불완전했던 레짐 전용 다운로드 UI와 API 제거
- 통합 문서 구조·희소 데이터 처리·출력 크기·레짐 Export 제거에 대한 회귀 테스트 추가

## v1.12.0 주요 변경

- 관세청 DRAM 신고중량을 bit 출하량으로 오인하던 판정 경로를 제거하고 DRAM 칩 수출액을 주축, MCP·DRAM 모듈 수출액을 확인축으로 재구성
- 구조적 전년비와 최근 3개월 순차 변화를 분리해 수출 증가와 단기 감속을 동시에 확인하도록 보강
- 미 재무부 공식 10Y·30Y 명목·실질금리를 별도 캐시하고 30년물 실질금리·30Y-10Y·20·63관측일 변화로 장기 듀레이션 부담 경보 추가
- 30년물은 기존 10Y 금리 레짐의 제한된 확인축으로만 반영해 중복 점수를 막고 금리 지표를 정책·명목 장기금리·실질/기대물가·곡선/기간 프리미엄 순으로 재배치
- DRAM 수출 분해, 미 재무부 XML 수집, 30년물 경보 임계값과 화면 계층에 대한 회귀 테스트 추가

## v1.11.3 주요 변경

- 내부 판정값과 스냅샷 형식은 유지하면서 화면의 판정 문구를 경제적 의미가 드러나는 한국어로 변환
- 정책금리·장기금리·최근 금리 충격·수익률곡선을 서로 다른 문맥으로 설명하고 관련 도움말을 보강
- AI CAPEX·DRAM·HBM·반도체 수급·전력·기업 공시와 History의 축약 분류명을 구체적인 관측 문장으로 교체
- 긴 판정 문구의 줄바꿈과 선택 영역 폭을 보정하고 데스크톱·모바일 넘침 회귀검사를 추가

## v1.11.2 주요 변경

- AI 인프라 투자 가설을 `CAPEX → DRAM·HBM → 실적·재고 확인 → 전력 후속` 4단계 흐름으로 재구성
- 핵심 판정과 상충 신호는 항상 노출하고 HBM 프록시·수출 구조·기업 공시·광의 재고 상세는 한 단계 펼치기로 정리
- 데스크톱과 모바일의 읽기 순서를 통일하고 CAPEX·DRAM 카드 높이 불균형 및 보조 데이터 중첩 완화
- NAND, 관측 범위와 원본 링크를 하나의 보조·원자료 영역으로 통합

## v1.11.1 주요 변경

- 지표 변화값을 단순 부호가 아니라 현재 투자 가설에 대한 강화·관찰·훼손·중립 의미로 구분
- 국내 반도체 기업의 매출·영업이익률은 실적 확장 규칙을 통과한 경우에만 강조하고 재고 절대액·공급사 CAPEX는 중립 유지
- 단일 하이퍼스케일러 CAPEX 감소를 즉시 훼손으로 보지 않고 관찰 신호로 완화하며 메모리 가격 표본별 대표성을 색상에 반영
- 차트 계열색과 판정 의미색을 분리하고 성장·고용·신용의 명확한 파생 변화에 일관된 의미색 적용

## v1.11.0 주요 변경

- 현재 정책·실질금리 제약, 최근 20·63관측일 충격, 10Y-3M 침체 선행위험을 분리한 일일 금리 레짐 모델 추가
- 뉴욕 연은 공개 probit 식과 21관측일 평균, 역전 지속·해소 후 252관측일 기억을 결정론적 규칙으로 구현
- 10Y-2Y는 확인축으로만 사용하고 현재 10년 기간 프리미엄을 `THREEFYTP10`으로 교정해 TIPS와 중복 점수 제거
- 금리 탭에 3계층 판정 근거와 수익률곡선 주축·확인축 차트를 추가하고 공식 수식·경계값 회귀 테스트 보강

## v1.10.1 주요 변경

- OpenDART 매출·영업이익률·재고·CAPEX의 역할과 기준분기를 분리하고 회사별 맥락 판정을 추가
- 재고 YoY 절대액과 분기매출 대비 상대 재고부담을 함께 표시하며 물리적 `재고 소화` 표현을 제거
- 같은 DART 매출·재고 파생값을 HBM 간접계측에 독립 신호로 중복 반영하지 않도록 판정 계보 교정
- DRAM 수출 구조의 공통 기준월·곱셈 브리지와 공급사별 재고/매출 자기추세 차트로 표현 개선

## v1.10.0 주요 변경

- HBM·서버 DRAM을 서버 RDIMM 공개가격, DRAM 수출 단가·물량 분해, SK하이닉스 매출 대비 재고비율로 간접계측
- 수출액 급증을 물량과 단위중량당 수출액·제품 믹스로 분리하고 상충 신호를 별도 보존
- 현재 화면에 간접계측 구성요소를, 상세 화면에 수출 구조와 공급사 재고 효율 시계열을 추가

## v1.9.1 주요 변경

- 공개 DDR5 가격과 DRAM 수출을 반도체 주 판정축으로 연결하고 광의 KOSIS 완제품 재고를 보조축으로 재배치
- 완제품 재고의 역사적 수준·재고/출하 비율·2개월 지속성을 함께 확인해 저수준 단기 반등의 `재고 부담` 오판 방지
- 현재·상세 화면에서 DRAM 핵심축과 완제품 재고의 백분위·비연율화 3개월 변화를 명시

## v1.9.0 주요 변경

- 투자 레짐 `현재` 화면을 거시 판단과 AI 인프라 투자 가설 모니터로 분리
- AI 가설을 CAPEX, 가격·수요, 공급·재고, 기업 확인, 전력 맥락의 독립축으로 재구성
- 기존 관측 범위 9개를 접힌 연결 현황으로 보존하고 Snapshot 이후 가설축 변화 알림 추가
- 상세 지표를 `거시·시장`과 `AI 투자 가설`로 그룹화하고 DRAM/NAND를 `메모리·반도체`로 이동

## v1.8.0 주요 변경

- KOSIS 반도체 생산·출하·재고와 관세청 메모리·DRAM·플래시 수출 시계열 연결
- OpenDART 삼성전자·SK하이닉스 분기 CAPEX·매출·영업이익·재고 확인 축 추가
- EIA 미국 전력판매·순발전량·순하계 설비용량을 전력 수요 맥락으로 연결
- 외부 원자료·피드 상태 캐시, 실패 소스별 재시도와 Snapshot/Export 보존 추가
- 투자 레짐 현재 화면과 지표 화면에 반도체 수급·전력 수요 판정 카드 및 차트 추가

## v1.7.0 주요 변경

- NAS에서 차단되던 BLS ICS 대신 기존 FRED API 키로 미래 주요 거시 발표일 수집
- CPI·PPI·고용·JOLTS에 GDP·PCE·소매판매 일정을 추가하고 날짜·시각 정밀도 구분
- 일부 일정 갱신 실패 시 마지막 정상 캐시를 계속 표시하도록 수집과 화면을 보강

## v1.3.3 주요 변경

- 현재 점검 항목·판단 변경 신호·좌표 기여도에 판정 의미 도움말 추가
- 지표 상태를 중립·주의·악화 범위로 명확히 하고 지표별 판정 기간과 개선·악화 방향 표시
- 상세점검 헤더와 심각도 배지의 줄바꿈 및 여백 교정

## v1.3.2 주요 변경

- 백업의 포트폴리오·자산·플랜 식별자를 보존하여 반복 가져오기를 멱등적으로 수정
- 동명 포트폴리오가 있는 구형 백업의 모호한 복원을 차단하고 가져오기를 단일 트랜잭션으로 처리
- API 테스트를 임시 SQLite DB로 격리하여 로컬 운용 DB 오염 방지

## v1.3.1 주요 변경

- 레짐 화면의 산식·용어·주의사항을 본문 설명문 대신 제목·판정 컬럼의 접근 가능한 도움말로 재배치
- 시장 상대 흐름 차트의 화면 설명과 정규화 방법론을 분리

## v1.3.0 주요 변경

- FRED 시계열 pagination과 지표별 성공·실패·재시도 상태 추가
- 거시 레짐 hysteresis를 무관한 화면 갱신이 아닌 핵심 발표 근거 변화로 확인
- 일·주·월·분기별 차트 표시 기간을 분리하고 금리 변화는 bp, 물가는 YoY·3개월 연율로 교정
- 레짐 산출·경보 전용·맥락 지표 역할과 관측일·이용 가능일을 구분 표시
- 금·은 선물 시계열 및 동일 관측일 기반 금은비 캐시 추가
- 최근 변화 우선 영역, 화면 도움말과 모바일 전달경로 카드 추가

## v1.2.0 주요 변경

- 투자 레짐 시장 지표를 요청 시 외부 조회 방식에서 SQLite 관측값 캐시 방식으로 전환
- WTI·구리·광의 달러 지표를 추가하고 KOSPI도 정기 수집 캐시에 통합
- 주요 위험자산을 시작값 100으로 비교하는 추세 차트와 기간별 변화 카드로 시장 화면 재구성
- 신뢰도 낮고 호출이 느린 무료 PER 자동 조회를 제거하고 데이터 기준일·수집 시각을 명시

## v1.1.1 주요 변경

- 화면 테마를 다크모드로 고정하고 분석 대시보드용 색상 토큰으로 통합
- 투자 레짐의 절대상태·압력 방향 차트와 상태 배지 대비 개선
- 라이트/다크 전환 UI와 테마별 하드코딩 충돌 제거

## v1.1.0 주요 변경

- 결정론적 규칙 기반 투자 레짐 독립 탭 추가
- FRED 관측값 SQLite 캐시, 자동 갱신, hysteresis 판정 추가
- 공식 Snapshot/History, 사용자 판단 메모 및 외부 분석용 Markdown Export 추가
- 상세 시장현황을 레짐 탭으로 이동하고 메인 대시보드에는 축약 레짐 카드 제공

## v1.0.1 주요 변경

- SQLite 런타임 연결의 과거 Supabase 호환 명칭을 데이터베이스 중심 명칭으로 정리
- 기존 Supabase 연동은 최초 데이터 이관 전용 도구로만 명확히 분리

## v1.0.0 주요 변경

- 운영 DB를 Supabase에서 NAS 내장 SQLite로 전환
- Supabase 전체 데이터 읽기 전용 백업 및 검증 이관 도구 추가
- SQLite WAL, 인덱스, 순차 DB 마이그레이션 적용
- 배포 전 SQLite online backup과 코드 snapshot 적용
- NAS 소스 전송·빌드·health check 자동화
- Docker build context 최적화

## 라이선스

MIT
