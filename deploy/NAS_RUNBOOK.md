# NAS 운영 배포 런북

이 문서는 `main` 브랜치 병합본을 Synology NAS 운영 환경에 적용할 때 사용하는 기준 절차다.

## 확정된 운영 환경

- 저장소 기본 브랜치: `main`
- SSH: `fhipuer@192.168.0.9`, 포트 `1024`
- SSH 인증: 로컬 `~/.ssh/id_ed25519` 공개키 등록 완료
- 운영 경로: `/var/services/homes/fhipuer/meowney`
- 기존 최초 설치 백업: `/var/services/homes/fhipuer/meowney-backup-20260816-113817`
- NAS: Synology DS220+
- Docker Engine: `20.10.3`
- Compose: `docker-compose 1.28.5`
- NAS에는 Git이 설치되어 있지 않음
- Frontend: `http://192.168.0.9:3000`
- Backend: `http://192.168.0.9:8000`
- 운영 DB: `/var/services/homes/fhipuer/meowney/data/meowney.db`

비밀번호, `.env` 내용, 개인키는 문서나 Git에 기록하지 않는다.

## 배포 승인 범위

사용자가 `main에 병합했으니 NAS에 배포해줘`처럼 명시적으로 요청한 경우에만 운영 배포를 수행한다.
일반 코드 변경, 테스트, 리뷰 요청은 운영 배포 권한을 포함하지 않는다.

## 표준 배포

1. 로컬 브랜치가 `main`인지 확인한다.
2. `origin/main`과 동기화됐는지 확인한다.
3. 작업 트리가 깨끗한지 확인한다.
4. 백엔드 테스트와 프론트엔드 빌드를 통과시킨다.
5. SSH와 NAS Docker 권한을 확인한다.
6. 아래 스크립트를 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1
```

로컬 루트 `.env`를 운영 환경에 함께 반영해야 할 때만 명시적으로 다음 옵션을 사용한다.
비밀값은 Git과 소스 아카이브에 포함되지 않고 SSH로 별도 전송되며 NAS에서 권한 `600`으로 저장된다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-to-nas.ps1 -DeployEnv
```

스크립트는 다음을 자동 수행한다.

1. `main` 및 clean worktree 강제
2. 비밀값과 로컬 DB를 제외한 소스 아카이브 생성
3. NAS 전송 후 SHA-256 검증
4. SQLite online backup 생성
5. 현재 코드 snapshot 생성
6. NAS에서 Docker 이미지 빌드
7. 미적용 SQLite migration 실행
8. 컨테이너 교체
9. health check, DB 무결성 및 테이블 건수 확인

## Docker 권한

Synology Docker 소켓은 기본적으로 `root:root 660`이며 `fhipuer`는 직접 접근할 수 없다.
배포 직전에 사용자가 NAS에서 다음 명령을 실행해야 할 수 있다.

```bash
sudo chmod 666 /var/run/docker.sock
```

배포 완료 직후 반드시 복원한다.

```bash
sudo chmod 660 /var/run/docker.sock
```

권한을 열어둔 채 방치하지 않는다. 향후 무인 배포가 필요하면 Synology 작업 스케줄러 또는
제한된 sudo 정책을 별도로 설계한다.

## 수동 검증

```bash
export PATH=/usr/local/bin:$PATH
cd /var/services/homes/fhipuer/meowney
docker-compose ps
docker inspect meowney-backend | grep -m1 healthy
sqlite3 data/meowney.db < database/verify-sqlite.sql
```

외부에서는 다음 주소를 확인한다.

```text
http://192.168.0.9:8000/health
http://192.168.0.9:3000/api/v1/dashboard/portfolio
```

## 롤백

배포 전 생성된 다음 파일을 사용한다.

- `backups/meowney-pre-release-YYYYMMDD-HHMMSS.db`
- `backups/code-pre-release-YYYYMMDD-HHMMSS.tar.gz`

롤백은 데이터 손실 위험이 있으므로 자동 수행하지 않는다. 컨테이너를 중지하고 현재 DB를
별도로 보존한 뒤, 선택한 코드와 DB 백업을 복원하고 다시 빌드한다.
