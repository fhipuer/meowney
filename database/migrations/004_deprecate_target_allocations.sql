-- ============================================
-- 004: target_allocations 테이블 폐기 냥~ 🐱
-- ============================================
-- 레거시 카테고리 기반 목표 배분을 플랜 기반으로 대체
-- 기존 데이터는 백업용으로 유지 (테이블명 변경)

-- Step 1: target_allocations 테이블을 백업 테이블로 이름 변경
-- 주의: 프로덕션에서는 충분한 테스트 후 실행

-- 테이블 존재 확인 후 이름 변경
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'target_allocations') THEN
        -- 백업 테이블이 이미 존재하면 삭제
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'target_allocations_deprecated') THEN
            DROP TABLE target_allocations_deprecated;
        END IF;

        -- 테이블 이름 변경
        ALTER TABLE target_allocations RENAME TO target_allocations_deprecated;

        -- 코멘트 추가
        COMMENT ON TABLE target_allocations_deprecated IS
            '[DEPRECATED] 레거시 카테고리 기반 목표 배분 (2024.01 폐기) - rebalance_plans 사용';
    END IF;
END
$$;

-- ============================================
-- 참고: 폐기 후 변경 사항
-- ============================================
-- 1. 목표 배분은 rebalance_plans + plan_allocations 사용
-- 2. 그룹 배분은 allocation_groups + allocation_group_items 사용
-- 3. 대시보드 알림은 메인 플랜 기반으로 동작
-- 4. 레거시 API는 폴백으로 유지 (메인 플랜 없을 때만)

-- ============================================
-- 롤백 스크립트 (필요시)
-- ============================================
-- ALTER TABLE target_allocations_deprecated RENAME TO target_allocations;
