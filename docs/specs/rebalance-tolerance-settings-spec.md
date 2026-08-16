# 리밸런싱 허용 오차 설정 스펙

## 1. 개요

### 배경 및 목적
- 현재 리밸런싱 페이지의 허용 오차(0.5%)는 로컬 상태만 존재하여 저장되지 않음
- 대시보드 리밸런싱 알림의 threshold(5.0%)는 하드코딩되어 변경 불가
- 사용자가 자신에게 맞는 허용 오차를 설정하고 저장할 수 있도록 개선

### 핵심 가치 제안
- **개인화**: 사용자별 리밸런싱 민감도 설정 가능
- **일관성**: 설정한 기본값이 앱 전체에서 일관되게 적용
- **유연성**: 계산기에서는 세션 중 임시로 다른 값 사용 가능

---

## 2. 요구사항

### 기능 요구사항

1. **설정 저장**
   - 알림용 threshold와 계산기용 tolerance 두 가지 값을 별도로 설정
   - DB(user_settings 테이블)에 저장
   - 단일 사용자 전제 (고정 UUID 사용)

2. **설정 UI**
   - 설정 페이지에 "리밸런싱 설정" 섹션 추가
   - 슬라이더 2개로 각각 조정
   - 저장 버튼 클릭 시 DB에 저장

3. **대시보드 알림**
   - 저장된 alert_threshold 값을 사용하여 알림 표시
   - 기본값: 5%

4. **리밸런싱 계산기**
   - 페이지 로드 시 저장된 calculator_tolerance를 기본값으로 표시
   - 사용자가 변경해도 기본값은 유지 (세션 중만 적용)
   - 기본값: 5%

5. **첫 방문 처리**
   - 설정이 없으면 기본값(5%, 5%)으로 자동 생성

### 비기능 요구사항

- 값 범위: 0~20%
- 단위: 0.5% 단위
- 응답 시간: 설정 조회/저장 1초 이내

---

## 3. 사용자 시나리오

### 시나리오 1: 첫 방문 사용자
1. 사용자가 앱에 처음 접속
2. 시스템이 기본값(alert: 5%, calculator: 5%)으로 user_settings 레코드 생성
3. 대시보드 알림은 5% 이상 이탈 시 표시
4. 리밸런싱 계산기는 5%를 기본값으로 표시

### 시나리오 2: 설정 변경
1. 사용자가 설정 페이지 접속
2. "리밸런싱 설정" 섹션에서 슬라이더로 값 조정
   - 알림 기준: 3%로 변경 (더 민감하게)
   - 계산기 기본값: 5% 유지
3. "저장" 버튼 클릭
4. 대시보드로 돌아가면 3% 이상 이탈 시 알림 표시

### 시나리오 3: 계산기에서 임시 변경
1. 리밸런싱 페이지에서 계산기 사용
2. 기본값 5%가 표시됨
3. 이번 계산만 1%로 변경하여 세밀하게 확인
4. 페이지 나갔다 들어오면 다시 5%로 표시

---

## 4. 기술 설계

### 데이터 모델

**새 테이블: user_settings**
```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    calculator_tolerance DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 기본 사용자 설정 자동 생성을 위한 트리거 또는 앱 로직에서 처리
```

**고정 사용자 ID**: `00000000-0000-0000-0000-000000000001` (단일 사용자)

### API 설계

**GET /api/v1/settings**
- 설정 조회
- 없으면 기본값으로 생성 후 반환

```typescript
// Response
{
  user_id: string
  alert_threshold: number  // 0-20 범위
  calculator_tolerance: number  // 0-20 범위
}
```

**PUT /api/v1/settings**
- 설정 저장/업데이트

```typescript
// Request
{
  alert_threshold?: number
  calculator_tolerance?: number
}

// Response
{
  user_id: string
  alert_threshold: number
  calculator_tolerance: number
  updated_at: string
}
```

### 프론트엔드 상태 관리

**Zustand 스토어 확장 (useStore.ts)**
```typescript
interface StoreState {
  // 기존 상태...

  // 리밸런싱 설정 (서버에서 로드)
  alertThreshold: number
  calculatorTolerance: number
  setAlertThreshold: (value: number) => void
  setCalculatorTolerance: (value: number) => void
}
```

**React Query 훅 (useSettings.ts)**
```typescript
// 설정 조회
useSettings(): { data: UserSettings, isLoading, error }

// 설정 저장
useUpdateSettings(): { mutate, isLoading }
```

---

## 5. UI/UX 설계

### 설정 페이지 섹션

```
┌─────────────────────────────────────────────────────┐
│ 리밸런싱 설정                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📊 대시보드 알림 기준                                │
│ 목표 비율에서 이 값 이상 벗어나면 알림을 표시합니다    │
│                                                     │
│ [━━━━━━━━━━●━━━━━━━━━━] 5.0%                        │
│  0%                  20%                           │
│                                                     │
│ ⚖️ 리밸런싱 계산기 기본값                            │
│ 리밸런싱 페이지에서 사용할 기본 허용 오차입니다        │
│                                                     │
│ [━━━━━━━━━━●━━━━━━━━━━] 5.0%                        │
│  0%                  20%                           │
│                                                     │
│                              [저장]                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 슬라이더 스펙
- 범위: 0% ~ 20%
- 단위: 0.5% 단위 (step=0.5)
- 현재 값 표시: 슬라이더 우측에 숫자로 표시

---

## 6. 보안 고려사항

- 현재 인증 없이 단일 사용자 전제
- user_id는 고정 UUID 사용
- 향후 인증 추가 시 user_id를 실제 사용자로 마이그레이션 필요

---

## 7. 테스트 계획

### 백엔드 테스트
- [ ] GET /settings: 설정 없을 때 기본값 생성 확인
- [ ] GET /settings: 기존 설정 조회 확인
- [ ] PUT /settings: 설정 업데이트 확인
- [ ] PUT /settings: 범위 벗어난 값 거부 확인 (0-20 범위)

### 프론트엔드 테스트
- [ ] 설정 페이지: 슬라이더 조작 및 저장
- [ ] 대시보드: 설정된 threshold로 알림 표시
- [ ] 리밸런싱 페이지: 기본값 로드 및 세션 중 변경

---

## 8. 제약사항 및 가정

### 제약사항
- 단일 사용자 시스템 (인증 없음)
- 브라우저간 설정 공유됨 (DB 저장)

### 가정
- 사용자는 한 명만 있음
- 향후 인증 추가 시 마이그레이션 가능한 구조

---

## 9. 구현 순서

1. **DB**: user_settings 테이블 생성
2. **백엔드**: settings API 엔드포인트 추가
3. **프론트엔드**: useSettings 훅 생성
4. **설정 페이지**: 리밸런싱 설정 섹션 추가
5. **대시보드**: RebalanceAlert에서 설정값 사용
6. **리밸런싱 페이지**: 기본값 로드 적용

---

## 10. 수정 대상 파일

### 새로 생성
| 파일 | 설명 |
|------|------|
| `database/migrations/xxx_user_settings.sql` | 테이블 생성 |
| `backend/app/api/v1/settings.py` | 설정 API |
| `frontend/src/hooks/useSettings.ts` | 설정 훅 |

### 수정
| 파일 | 변경 내용 |
|------|----------|
| `backend/app/api/v1/router.py` | settings 라우터 등록 |
| `backend/app/models/schemas.py` | UserSettings 스키마 추가 |
| `frontend/src/lib/api.ts` | settings API 함수 추가 |
| `frontend/src/types/index.ts` | UserSettings 타입 추가 |
| `frontend/src/pages/SettingsPage.tsx` | 리밸런싱 설정 섹션 추가 |
| `frontend/src/pages/RebalancePage.tsx` | 기본값 로드 적용 |
| `frontend/src/components/dashboard/RebalanceAlert.tsx` | 설정값 사용 |
