-- ============================================
-- 003: 그룹 weight 시스템 단순화 냥~ 🐱
-- ============================================
-- 그룹 내 개별 아이템의 weight를 제거하고 단순 합산 방식으로 변경
-- 기존 데이터는 유지하되, 로직에서 무시됨

-- allocation_group_items.weight 컬럼을 nullable로 변경 (기존 데이터 보존)
ALTER TABLE allocation_group_items
ALTER COLUMN weight DROP NOT NULL;

-- weight 컬럼의 기본값을 NULL로 변경
ALTER TABLE allocation_group_items
ALTER COLUMN weight SET DEFAULT NULL;

-- 코멘트 추가: 이 컬럼은 더 이상 사용되지 않음
COMMENT ON COLUMN allocation_group_items.weight IS
'[DEPRECATED] 그룹 내 비중 (더 이상 사용되지 않음 - 2024.01)';

-- ============================================
-- 참고: 이 마이그레이션 후 변경 사항
-- ============================================
-- 1. 그룹의 target_percentage만 사용됨
-- 2. 그룹 내 자산들은 단순 합산으로 현재가치 계산
-- 3. 리밸런싱 제안은 그룹 단위로만 제공 (개별 아이템 목표 없음)
