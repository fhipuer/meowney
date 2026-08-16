# 로컬 SQLite 운영 가이드

Meowney의 운영 데이터는 Supabase가 아니라 NAS의 `data/meowney.db`에 저장됩니다.
코드와 DB 마이그레이션만 Git으로 관리하며 `.env`, DB, 백업 파일은 커밋하지 않습니다.

## 최초 Supabase 이관

저장소 루트의 `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 넣은 뒤 실행합니다.
이 명령은 Supabase를 읽기만 하며 JSON 백업을 만든 다음 SQLite에 복원합니다.

```bash
python backend/scripts/migrate_supabase.py all \
  --output backups/supabase-backup-initial.json \
  --database-url sqlite:///./data/meowney.db
```

JSON과 SQLite의 테이블별 레코드 수가 다르면 명령이 실패합니다. Supabase 원본은
전환 확인이 끝날 때까지 보존하십시오.

## 배포

NAS 운영 경로는 `/var/services/homes/fhipuer/meowney`입니다. NAS에는 Git이 없으므로
로컬의 검증된 `main` 소스를 배포 스크립트로 전송합니다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1
```

배포 스크립트는 다음 작업을 수행합니다.

1. 로컬 `main`과 clean worktree 확인
2. 소스 전송 및 SHA-256 검증
3. 실행 중인 SQLite DB와 현재 코드 백업
4. Docker 이미지 빌드 및 미적용 DB 마이그레이션 실행
5. 컨테이너 교체, DB 무결성 및 health check 확인

상세 운영 절차는 [NAS 운영 배포 런북](../deploy/NAS_RUNBOOK.md)을 따릅니다.

## 수동 백업과 복원

```bash
docker compose run --rm meowney-backend python scripts/backup_sqlite.py \
  --source /data/meowney.db --destination /backups/meowney-manual.db
```

복원할 때는 서비스를 내린 뒤 선택한 백업을 `data/meowney.db`로 복사합니다.
NAS 자체 장애에 대비해 `backups/`는 다른 장치나 클라우드에도 복제해야 합니다.

## 마이그레이션 추가

`backend/app/db/migrations/`에 `002_description.sql`처럼 순번 SQL 파일을 추가합니다.
애플리케이션 시작과 배포 과정에서 아직 기록되지 않은 파일만 한 번 적용됩니다.
