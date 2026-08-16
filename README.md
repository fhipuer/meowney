# Meowney (먀우니) 🐱💰

> 개인 자산 포트폴리오, 일별 자산 추이와 리밸런싱을 한곳에서 관리하는 대시보드

**버전**: 1.1.0

## 주요 기능

- 총자산, 수익률, 환율과 시장 지표 대시보드
- 국내·해외 주식, ETF, 현금 등 자산 관리와 실시간 시세 조회
- 일별 자산 스냅샷 및 기간별 추이 차트
- 목표 비율과 5/25 밴드 기반 리밸런싱 제안
- 개별 자산 및 그룹 배분 플랜
- 과거 자산 데이터 수동 입력
- 자산배분 가이드, 추천 포트폴리오와 투자 성향 퀴즈
- 자산·플랜 데이터 JSON 가져오기/내보내기

## 아키텍처

```text
Browser
  └─ Nginx / React
       └─ FastAPI
            ├─ SQLite: 포트폴리오와 히스토리
            ├─ yfinance: 현재가와 시장 데이터
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
