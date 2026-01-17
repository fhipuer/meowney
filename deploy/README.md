# Meowney NAS 배포 가이드 🐱

## 폴더 구조

```
deploy/
├── docker-compose.yml    # Docker 구성 파일
├── meowney-images.tar.gz # Docker 이미지 압축 파일
├── .env.example          # 환경변수 템플릿
└── README.md             # 이 파일
```

## 배포 방법

### 1단계: 파일 전송

deploy 폴더 전체를 NAS로 복사합니다.
- FTP, SMB, SCP 등 원하는 방식으로 전송

### 2단계: Docker 이미지 로드

NAS SSH 접속 후:

```bash
cd /path/to/deploy
docker load < meowney-images.tar.gz
```

로드 완료 후 확인:
```bash
docker images | grep meowney
```

### 3단계: 환경변수 설정

```bash
cp .env.example .env
nano .env  # 또는 vi .env
```

필수 입력 항목:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase anon 키
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role 키

### 4단계: 컨테이너 실행

```bash
docker-compose up -d
```

### 5단계: 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 로그 확인
docker-compose logs -f

# 백엔드 헬스체크
curl http://localhost:8000/health
```

## 접속 주소

- 프론트엔드: `http://NAS_IP:3000`
- 백엔드 API: `http://NAS_IP:8000/api/v1`

## 포트 설정

기본 포트를 변경하려면 `docker-compose.yml` 수정:

```yaml
ports:
  - "원하는포트:8000"  # 백엔드
  - "원하는포트:80"    # 프론트엔드
```

## 관리 명령어

```bash
# 중지
docker-compose down

# 재시작
docker-compose restart

# 로그 보기 (실시간)
docker-compose logs -f meowney-backend
docker-compose logs -f meowney-frontend

# 컨테이너 쉘 접속
docker exec -it meowney-backend /bin/bash
```

## 업데이트 방법

1. 새 이미지 파일 전송
2. 기존 컨테이너 중지: `docker-compose down`
3. 새 이미지 로드: `docker load < meowney-images.tar.gz`
4. 컨테이너 재시작: `docker-compose up -d`

## 문제 해결

### 컨테이너가 시작되지 않을 때
```bash
docker-compose logs meowney-backend
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
netstat -tlnp | grep 8000
```

### 이미지 로드 실패
```bash
# 압축 파일 무결성 확인
gzip -t meowney-images.tar.gz
```

---
냥~ 배포 성공을 빕니다! 🐱
