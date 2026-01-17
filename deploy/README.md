# Meowney NAS 배포 가이드 🐱

**버전**: 0.5.0

## 폴더 구조

```
deploy/
├── docker-compose.yml    # Docker 구성 파일
├── meowney-images.tar.gz # Docker 이미지 압축 파일
├── .env.example          # 환경변수 템플릿
├── .env                  # 환경변수 (직접 생성)
├── start.sh              # 시작 스크립트
├── stop.sh               # 중지 스크립트
├── update.sh             # 업데이트 스크립트
├── logs.sh               # 로그 확인 스크립트
└── README.md             # 이 파일
```

## 배포 방법

### 1단계: 파일 전송

deploy 폴더 전체를 NAS로 복사합니다.
- SMB: `\\NAS_IP\docker\meowney`
- 또는 파일 스테이션에서 업로드

### 2단계: SSH 접속

```bash
ssh -p 포트번호 사용자명@NAS_IP
cd /volume1/docker/meowney
```

### 3단계: 스크립트 실행 권한 부여

```bash
chmod +x *.sh
```

### 4단계: 환경변수 설정

```bash
cp .env.example .env
vi .env
```

필수 입력 항목:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase anon 키

### 5단계: 이미지 로드 및 실행

```bash
./update.sh
```

또는 수동으로:
```bash
sudo docker load < meowney-images.tar.gz
sudo docker-compose up -d
```

## 관리 스크립트

| 스크립트 | 용도 |
|---------|------|
| `./start.sh` | 컨테이너 시작 |
| `./stop.sh` | 컨테이너 중지 |
| `./update.sh` | 이미지 로드 + 재시작 |
| `./logs.sh` | 실시간 로그 확인 (Ctrl+C 종료) |

## 접속 주소

### 내부망 (로컬)
- 프론트엔드: `http://NAS_IP:3000`
- 백엔드 API: `http://NAS_IP:8000/api/v1`

### 외부 접속 (포트포워딩 필요)

1. **공유기 포트포워딩 설정**
   - 외부 3000 → 내부 NAS_IP:3000
   - 외부 8000 → 내부 NAS_IP:8000

2. **DDNS 사용 시**
   - 프론트엔드: `http://your-domain.synology.me:3000`
   - 백엔드: `http://your-domain.synology.me:8000`

3. **프론트엔드 재빌드** (외부 도메인 사용 시)
   - 로컬에서 `frontend/.env`의 `VITE_API_URL`을 외부 도메인으로 변경
   - `docker-compose build` 후 이미지 재전송

## 포트 변경

`docker-compose.yml` 수정:

```yaml
ports:
  - "원하는포트:8000"  # 백엔드
  - "원하는포트:80"    # 프론트엔드
```

## 업데이트 방법

1. 로컬에서 코드 수정 후 이미지 빌드
   ```bash
   docker-compose build
   docker save meowney-meowney-backend meowney-meowney-frontend | gzip > deploy/meowney-images.tar.gz
   ```

2. NAS로 `meowney-images.tar.gz` 전송

3. NAS SSH에서:
   ```bash
   ./update.sh
   ```

## 문제 해결

### 컨테이너가 시작되지 않을 때
```bash
sudo docker-compose logs meowney-backend
sudo docker-compose logs meowney-frontend
```

### 포트 충돌
```bash
netstat -tlnp | grep 8000
netstat -tlnp | grep 3000
```

### 이미지 로드 실패
```bash
gzip -t meowney-images.tar.gz
```

### API 연결 실패 (외부 접속 시)
- 포트포워딩 설정 확인
- 프론트엔드 이미지의 `VITE_API_URL`이 외부 도메인인지 확인

---
냥~ 배포 성공을 빕니다! 🐱
