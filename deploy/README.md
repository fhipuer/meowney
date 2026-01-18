# Meowney NAS 배포 가이드 🐱

**버전**: 0.7.0

---

## NAS 접속 정보

| 항목 | 값 |
|------|-----|
| IP | 192.168.0.9 |
| SSH 포트 | 1024 |
| 사용자명 | fhipuer |
| 배포 경로 | `/volume1/homes/fhipuer/meowney/` |

---

## 폴더 구조

```
/volume1/homes/fhipuer/meowney/
├── .env                    # 환경 변수 (Supabase 키 등)
├── docker-compose.yml      # Docker Compose 설정
├── meowney-images.tar.gz   # Docker 이미지 (업로드됨)
├── update.sh               # 업데이트 스크립트
├── start.sh                # 시작 스크립트
├── stop.sh                 # 중지 스크립트
├── logs.sh                 # 로그 확인 스크립트
└── README.md               # 설명 문서
```

---

## 빠른 배포 (로컬 → NAS)

### Step 1: Docker 이미지 빌드 (로컬)

```bash
cd c:/Miz/Project/meowney
docker-compose build
```

### Step 2: 이미지 저장 및 압축 (로컬)

```bash
docker save meowney-meowney-backend:latest meowney-meowney-frontend:latest | gzip > meowney-images.tar.gz
```

### Step 3: NAS에 업로드 (로컬)

```bash
scp -O -P 1024 meowney-images.tar.gz fhipuer@192.168.0.9:/volume1/homes/fhipuer/meowney/
```

> **주의**: `-O` 옵션은 Synology NAS 호환성을 위한 레거시 SCP 프로토콜

### Step 4: NAS에서 업데이트 실행

```bash
# SSH 접속
ssh -p 1024 fhipuer@192.168.0.9

# 배포 디렉토리로 이동
cd /volume1/homes/fhipuer/meowney

# PATH 설정 (필요시)
export PATH=/usr/local/bin:$PATH

# 업데이트 실행
sudo ./update.sh
```

또는 수동으로:
```bash
sudo docker-compose down
sudo docker load < meowney-images.tar.gz
sudo docker-compose up -d
sudo docker-compose ps
```

### Step 5: 로컬 정리

```bash
rm meowney-images.tar.gz
```

---

## 환경 변수 (.env)

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
DEBUG=false
SNAPSHOT_HOUR=23
SNAPSHOT_MINUTE=0
TIMEZONE=Asia/Seoul
DEFAULT_USD_KRW_RATE=1350
```

---

## 관리 스크립트

| 스크립트 | 용도 |
|---------|------|
| `sudo ./start.sh` | 컨테이너 시작 |
| `sudo ./stop.sh` | 컨테이너 중지 |
| `sudo ./update.sh` | 이미지 로드 + 재시작 |
| `sudo ./logs.sh` | 실시간 로그 확인 (Ctrl+C 종료) |

---

## 서비스 URL

| 서비스 | URL |
|--------|-----|
| Frontend | http://192.168.0.9:3000 |
| Backend API | http://192.168.0.9:8000/api/v1 |
| Health Check | http://192.168.0.9:8000/health |

---

## 트러블슈팅

### Docker 권한 오류

```
PermissionError: [Errno 13] Permission denied
```

**해결**: 모든 docker 명령어 앞에 `sudo` 사용

### docker-compose 명령 없음

```
sh: docker-compose: command not found
```

**해결**: PATH에 `/usr/local/bin` 추가
```bash
export PATH=/usr/local/bin:$PATH
```

### SCP 연결 오류

```
subsystem request failed on channel 0
```

**해결**: `-O` 옵션 사용 (레거시 SCP 프로토콜)
```bash
scp -O -P 1024 file user@host:/path/
```

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

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v0.7.0 | 2026-01-18 | 계산 로직 일원화 (USD 환율 통일, 레거시 리밸런싱 API 제거) |
| v0.6.1 | 2026-01-18 | 벤치마크 제거, 투자원금 표시 개선 |
| v0.6.0 | 2026-01-18 | 자산 추이 차트 개선, 기간 선택, 과거 데이터 입력 |
| v0.5.1 | - | 버그 수정 |
| v0.5.0 | - | 초기 배포 |

---

냥~ 배포 성공을 빕니다! 🐱
