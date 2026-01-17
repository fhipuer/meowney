-- ============================================
-- Migration: allocation_groups 및 allocation_group_items 테이블 생성
-- 냥~ 그룹 배분 기능을 위한 테이블이다옹!
-- ============================================

-- 배분 그룹 테이블
CREATE TABLE IF NOT EXISTS allocation_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES rebalance_plans(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 배분 그룹 아이템 테이블
CREATE TABLE IF NOT EXISTS allocation_group_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES allocation_groups(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    ticker VARCHAR(20),
    alias VARCHAR(100),
    weight DECIMAL(5, 2) DEFAULT 100 CHECK (weight > 0 AND weight <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_item_key CHECK (
        asset_id IS NOT NULL OR ticker IS NOT NULL OR alias IS NOT NULL
    )
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_allocation_groups_plan ON allocation_groups(plan_id);
CREATE INDEX IF NOT EXISTS idx_allocation_group_items_group ON allocation_group_items(group_id);

-- 트리거 (updated_at 자동 갱신)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_allocation_groups_updated_at') THEN
        CREATE TRIGGER update_allocation_groups_updated_at
            BEFORE UPDATE ON allocation_groups
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- 완료 냥~! 🐱
