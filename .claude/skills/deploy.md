# /deploy - NAS 배포 스킬

NAS에 Meowney 애플리케이션을 배포하는 스킬입니다.

## 사용법

```
/deploy
```

## 배포 프로세스

이 스킬은 다음 단계를 자동으로 수행합니다:

1. **Docker 이미지 빌드**: 로컬에서 백엔드/프론트엔드 Docker 이미지 빌드
2. **이미지 저장 및 압축**: `docker save`로 이미지를 tar.gz로 압축
3. **NAS 업로드**: SCP로 압축 파일을 NAS에 업로드
4. **원격 업데이트**: SSH로 NAS에서 update.sh 실행

## 배포 설정

- **NAS IP**: 192.168.0.9
- **SSH 포트**: 1024
- **사용자명**: fhipuer
- **배포 경로**: /var/service/homes/fhipuer/meowney/
- **이미지 파일**: meowney-images.tar.gz

## 실행 단계

### Step 1: Docker 이미지 빌드

```bash
cd c:/Miz/Project/meowney
docker-compose build
```

### Step 2: 이미지 저장 및 압축

```bash
docker save meowney-meowney-backend:latest meowney-meowney-frontend:latest | gzip > meowney-images.tar.gz
```

### Step 3: NAS에 파일 업로드 (SCP)

```bash
scp -P 1024 meowney-images.tar.gz fhipuer@192.168.0.9:/var/service/homes/fhipuer/meowney/
```

### Step 4: NAS에서 업데이트 실행 (SSH)

```bash
ssh -p 1024 fhipuer@192.168.0.9 "cd /var/service/homes/fhipuer/meowney && ./update.sh"
```

## 주의사항

- SSH 비밀번호 입력이 필요합니다
- Docker 빌드 시간이 소요됩니다
- NAS가 네트워크에 연결되어 있어야 합니다
