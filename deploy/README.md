# Meowney NAS 배포

버전: 0.10.0

운영 서버에는 Git이 설치되어 있지 않으므로, 로컬 `main`의 검증된 소스를 전송하고 NAS에서 Docker 이미지를 빌드합니다.
데이터는 저장소의 `data/meowney.db`, 백업은 `backups/`에 영구 보관되며 둘 다 Git에서 제외됩니다.

## NAS 정보

- SSH: `fhipuer@192.168.0.9:1024`
- 설치 경로: `/var/services/homes/fhipuer/meowney`
- Frontend: `http://192.168.0.9:3000`
- Backend: `http://192.168.0.9:8000`

## 표준 업데이트

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1
```

`main` 브랜치와 clean worktree를 강제하며, SQLite 온라인 백업, 코드 snapshot,
소스 전송, 이미지 빌드, DB 마이그레이션, 재시작, health check 순서로 실행됩니다.
상세 절차와 Docker 소켓 권한은 [NAS 운영 배포 런북](NAS_RUNBOOK.md)을 따릅니다.

## 관리

```bash
deploy/start.sh
deploy/stop.sh
deploy/logs.sh
docker-compose ps
```

복원 전에는 서비스를 중지하고 `backups/`의 검증된 파일을 `data/meowney.db`로 복사하십시오.
