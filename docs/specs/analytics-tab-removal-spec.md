# 분석 탭 제거 스펙

## 1. 개요

### 배경 및 목적
- **현황**: 분석 탭(Analytics)이 레거시 코드로 구성되어 제대로 동작하지 않음
- **문제점**: 데이터가 안 나오거나, 잘못된 수치 표시, 벤치마크 API 실패 등
- **결정**: 분석 탭을 완전히 삭제하고, 추후 시장 조사 후 필요한 기능만 재설계

### 핵심 결정사항
- 분석 탭 관련 모든 코드 **완전 삭제** (프론트엔드 + 백엔드)
- 대시보드의 '목표 이탈' 알림 링크를 `/analytics` → `/rebalance`로 변경
- 별도 문서화 없이 삭제 진행

---

## 2. 삭제 범위

### 프론트엔드

| 파일/폴더 | 설명 |
|-----------|------|
| `src/pages/AnalyticsPage.tsx` | 분석 페이지 메인 컴포넌트 |
| `src/components/analytics/` | 전체 폴더 삭제 |
| ├─ `AllocationHistoryChart.tsx` | 자산 배분 변화 차트 |
| ├─ `PerformanceChart.tsx` | 수익률 추이 차트 |
| └─ `RebalanceHistoryChart.tsx` | 리밸런싱 분석 차트 |
| `src/App.tsx` | `/analytics` 라우트 제거 |
| `src/components/layout/Sidebar.tsx` | '분석' 네비게이션 항목 제거 |

### 백엔드 API

| 엔드포인트 | 파일 위치 | 설명 |
|-----------|----------|------|
| `GET /dashboard/benchmark/{ticker}` | `api/v1/dashboard.py` | 벤치마크 수익률 히스토리 |
| `GET /dashboard/performance` | `api/v1/dashboard.py` | 기간별 수익률 및 MDD |
| `GET /dashboard/rebalance-alerts` | `api/v1/dashboard.py` | 리밸런싱 필요 알림 |
| `GET /dashboard/goal-progress` | `api/v1/dashboard.py` | 목표 진행률 |
| `GET /dashboard/benchmark-history` | `api/v1/dashboard.py` | DB 기반 벤치마크 히스토리 |

### 타입/스키마

| 파일 | 제거할 타입 |
|------|------------|
| `frontend/src/types/index.ts` | `PerformanceMetrics`, `PeriodReturn`, `RebalanceAlert`, `RebalanceAlertsResponse`, `GoalProgressResponse` 등 |
| `frontend/src/lib/api.ts` | `dashboardApi`의 관련 함수들 (`getBenchmark`, `getPerformance`, `getRebalanceAlerts`, `getGoalProgress`) |
| `backend/app/models/schemas.py` | 관련 Pydantic 스키마 |

---

## 3. 수정 사항

### 대시보드 알림 링크 변경

**현재 동작**: 대시보드에서 목표 이탈 알림 클릭 시 `/analytics`로 이동

**변경 후**: `/rebalance`로 이동

**수정 파일**: 대시보드 컴포넌트에서 분석 탭으로의 링크를 찾아 변경

---

## 4. 구현 순서

1. **프론트엔드 페이지/컴포넌트 삭제**
   - `src/pages/AnalyticsPage.tsx` 삭제
   - `src/components/analytics/` 폴더 전체 삭제

2. **라우터 및 네비게이션 수정**
   - `App.tsx`에서 `/analytics` 라우트 제거
   - `Sidebar.tsx`에서 '분석' 메뉴 항목 제거

3. **대시보드 알림 링크 수정**
   - 목표 이탈 알림의 링크를 `/rebalance`로 변경

4. **프론트엔드 타입/API 정리**
   - `types/index.ts`에서 사용되지 않는 타입 제거
   - `lib/api.ts`에서 관련 API 함수 제거

5. **백엔드 API 삭제**
   - `dashboard.py`에서 관련 엔드포인트 제거
   - `schemas.py`에서 관련 스키마 제거

6. **빌드 및 테스트**
   - 프론트엔드 빌드 확인
   - 백엔드 테스트 실행
   - 전체 동작 확인

---

## 5. 테스트 계획

### 삭제 후 확인사항
- [ ] 프론트엔드 빌드 성공
- [ ] 백엔드 테스트 통과
- [ ] 사이드바에서 '분석' 메뉴 제거 확인
- [ ] `/analytics` 경로 접근 시 404 또는 리다이렉트
- [ ] 대시보드 목표 이탈 알림 클릭 → `/rebalance` 이동 확인

---

## 6. 추후 계획

- 시장 조사를 통해 개인 자산 관리 앱에 필요한 분석 기능 파악
- 토스, 뱅크샐러드 등 유사 앱의 분석 기능 참고
- 실제 사용 중 필요성이 느껴지면 그때 재설계

---

## 7. 미결정 사항

- 추후 분석 기능 재도입 시 구체적인 요구사항
- 벤치마크 비교 기능의 필요성 재검토
- 리밸런싱 알림 기능을 별도로 유지할지 여부

---

**작성일**: 2026-01-18
**버전**: 1.0
