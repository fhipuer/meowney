# Meowney (먀우니) 🐱💰

> 개인 자산 포트폴리오, 일별 자산 추이와 리밸런싱을 한곳에서 관리하는 대시보드

**버전**: 1.5.4

## 주요 기능

- 총자산, 수익률, 환율과 시장 지표 대시보드
- 국내·해외 주식, ETF, 현금 등 자산 관리와 실시간 시세 조회
- 일별 자산 스냅샷 및 기간별 추이 차트
- 목표 비율과 5/25 밴드 기반 리밸런싱 제안
- 개별 자산 및 그룹 배분 플랜
- 과거 자산 데이터 수동 입력
- 자산배분 가이드, 추천 포트폴리오와 투자 성향 퀴즈
- 자산·플랜 데이터 JSON 가져오기/내보내기
- 공식 BLS 발표 일정과 SEC XBRL 기반 4개사 AI CAPEX 캐시·판정
- TrendForce 공개 DRAM Contract·Spot 가격 저빈도 캐시와 메모리 가격 사이클

## 아키텍처

```text
Browser
  └─ Nginx / React
       └─ FastAPI
            ├─ SQLite: 포트폴리오와 히스토리
            ├─ FRED / yfinance: 거시·시장 데이터 수집
            ├─ SQLite: 레짐 관측값 캐시
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

- Frontend: http://localhost:5173
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
