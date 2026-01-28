-- ============================================
-- Meowney (먀우니) Database Schema
-- 냥~ 고양이 집사의 자산 관리 시스템
-- ============================================

-- Enable UUID extension (Supabase에서 기본 활성화되어 있지만 명시적으로)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. portfolios: 포트폴리오 메타 정보
-- 고양이 집사의 자산 포트폴리오 냥~
-- ============================================
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,  -- 포트폴리오 이름 (예: "나의 첫 번째 냥이 포트폴리오")
    description TEXT,             -- 설명
    base_currency VARCHAR(10) DEFAULT 'KRW',  -- 기준 통화
    target_value DECIMAL(18, 4),  -- 목표 자산 금액 (목표 설정용)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 포트폴리오 생성 (싱글 유저용)
INSERT INTO portfolios (name, description)
VALUES ('My Meowney Portfolio', '냥이 집사의 기본 포트폴리오 🐱');

-- ============================================
-- 2. asset_categories: 자산 카테고리
-- 주식, 현금, 채권 등 자산 유형 분류
-- ============================================
CREATE TABLE asset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,  -- 카테고리명
    color VARCHAR(7) DEFAULT '#6366f1', -- 차트 색상 (HEX)
    icon VARCHAR(50) DEFAULT 'paw',     -- 아이콘 이름
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 카테고리 삽입
INSERT INTO asset_categories (name, color, icon, display_order) VALUES
    ('국내주식', '#ef4444', 'cat', 1),      -- 빨간색 고양이
    ('해외주식', '#3b82f6', 'fish', 2),     -- 파란색 물고기
    ('현금', '#22c55e', 'coins', 3),        -- 초록색 동전
    ('채권', '#f59e0b', 'shield', 4),       -- 주황색 방패
    ('암호화폐', '#8b5cf6', 'sparkles', 5), -- 보라색 반짝이
    ('기타', '#6b7280', 'box', 6);          -- 회색 박스

-- ============================================
-- 3. assets: 보유 자산 목록
-- 각각의 자산 정보 (티커, 수량, 평단가 등)
-- ============================================
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,

    -- 자산 기본 정보
    name VARCHAR(100) NOT NULL,           -- 자산명 (예: "삼성전자", "Apple Inc.")
    ticker VARCHAR(20),                   -- 티커 심볼 (예: "005930.KS", "AAPL")
    asset_type VARCHAR(20) NOT NULL DEFAULT 'stock', -- stock, cash, bond, crypto, etc.

    -- 보유 정보
    quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,      -- 보유 수량 (소수점 8자리까지 for 암호화폐)
    average_price DECIMAL(18, 4) NOT NULL DEFAULT 0, -- 평균 매수가
    currency VARCHAR(10) DEFAULT 'KRW',               -- 자산 통화

    -- 현금성 자산용 (티커가 없는 경우)
    current_value DECIMAL(18, 4),         -- 직접 입력한 현재 가치 (현금, 예금 등)

    -- 환율 정보 (USD 자산용)
    purchase_exchange_rate DECIMAL(10, 4), -- 매수 시점 USD/KRW 환율 (예: 1350.00)

    -- 메타 정보
    notes TEXT,                           -- 메모 (냥이 집사의 투자 일기)
    is_active BOOLEAN DEFAULT TRUE,       -- 활성 상태
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_assets_portfolio_id ON assets(portfolio_id);
CREATE INDEX idx_assets_ticker ON assets(ticker);
CREATE INDEX idx_assets_category_id ON assets(category_id);

-- ============================================
-- 4. asset_history: 일별 자산 스냅샷
-- 매일 밤 11시에 저장되는 자산 추이 데이터 냥~
-- ============================================
CREATE TABLE asset_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,          -- 스냅샷 날짜

    -- 총액 정보
    total_value DECIMAL(18, 4) NOT NULL,  -- 총 평가액
    total_principal DECIMAL(18, 4) NOT NULL, -- 총 투자 원금
    total_profit DECIMAL(18, 4) NOT NULL,    -- 총 수익금 (total_value - total_principal)
    profit_rate DECIMAL(10, 4),              -- 수익률 (%)

    -- 카테고리별 금액 (JSON으로 저장)
    category_breakdown JSONB,             -- {"국내주식": 1000000, "해외주식": 500000, ...}

    -- 메타 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 포트폴리오별 날짜 유니크
    CONSTRAINT unique_portfolio_date UNIQUE (portfolio_id, snapshot_date)
);

-- 인덱스 생성
CREATE INDEX idx_asset_history_portfolio_id ON asset_history(portfolio_id);
CREATE INDEX idx_asset_history_snapshot_date ON asset_history(snapshot_date);

-- ============================================
-- 5. target_allocations: 목표 배분 비율 (레거시)
-- 카테고리 기준 리밸런싱용 (하위 호환성 유지)
-- ============================================
CREATE TABLE target_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_portfolio_category UNIQUE (portfolio_id, category_id)
);

-- ============================================
-- 6. rebalance_plans: 리밸런싱 플랜
-- 개별 자산 기준 목표 배분 플랜 관리
-- ============================================
CREATE TABLE rebalance_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- 플랜 이름 (예: "공격형 포트폴리오", "안정형 배분")
    description TEXT,                      -- 플랜 설명
    is_main BOOLEAN DEFAULT FALSE,         -- 메인 플랜 여부 (포트폴리오당 1개만 true)
    is_active BOOLEAN DEFAULT TRUE,        -- 활성 상태
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_rebalance_plans_portfolio ON rebalance_plans(portfolio_id);
CREATE INDEX idx_rebalance_plans_is_main ON rebalance_plans(portfolio_id, is_main) WHERE is_main = TRUE;

-- ============================================
-- 7. plan_allocations: 플랜별 목표 배분
-- 개별 자산(티커) 기준 목표 비율 설정
-- ============================================
CREATE TABLE plan_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES rebalance_plans(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,  -- 보유 자산 참조 (선택)
    ticker VARCHAR(20),                    -- 또는 티커로 직접 지정 (선택)
    target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- asset_id 또는 ticker 둘 중 하나는 필수
    CONSTRAINT check_asset_or_ticker CHECK (asset_id IS NOT NULL OR ticker IS NOT NULL)
);

-- 인덱스
CREATE INDEX idx_plan_allocations_plan ON plan_allocations(plan_id);
CREATE INDEX idx_plan_allocations_asset ON plan_allocations(asset_id);

-- ============================================
-- Updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_portfolios_updated_at
    BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_target_allocations_updated_at
    BEFORE UPDATE ON target_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rebalance_plans_updated_at
    BEFORE UPDATE ON rebalance_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_allocations_updated_at
    BEFORE UPDATE ON plan_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) 정책
-- Supabase에서 보안을 위해 활성화
-- (싱글 유저라면 비활성화해도 무방)
-- ============================================
-- ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE asset_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE target_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 뷰: 현재 포트폴리오 요약
-- ============================================
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT
    p.id AS portfolio_id,
    p.name AS portfolio_name,
    COUNT(a.id) AS total_assets,
    SUM(a.quantity * a.average_price) AS total_principal,
    MAX(a.updated_at) AS last_updated
FROM portfolios p
LEFT JOIN assets a ON p.id = a.portfolio_id AND a.is_active = TRUE
GROUP BY p.id, p.name;

-- 스키마 생성 완료!

-- ============================================
-- 마이그레이션: 기존 테이블에 새 컬럼/테이블 추가
-- 이미 테이블이 존재하는 경우 아래 쿼리 실행
-- ============================================
-- ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_exchange_rate DECIMAL(10, 4);
-- ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS target_value DECIMAL(18, 4);

-- 리밸런싱 플랜 테이블 (v2)
-- CREATE TABLE IF NOT EXISTS rebalance_plans (...);
-- CREATE TABLE IF NOT EXISTS plan_allocations (...);

-- 전략 프롬프트 컬럼 추가 (v3)
-- ALTER TABLE rebalance_plans ADD COLUMN IF NOT EXISTS strategy_prompt TEXT;

-- ============================================
-- 배분 시스템 확장 (v4)
-- ============================================

-- plan_allocations 테이블 확장
-- ALTER TABLE plan_allocations ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
-- ALTER TABLE plan_allocations ADD COLUMN IF NOT EXISTS alias VARCHAR(100);

-- 기존 check_asset_or_ticker 제약조건을 alias도 포함하도록 업데이트
-- ALTER TABLE plan_allocations DROP CONSTRAINT IF EXISTS check_asset_or_ticker;
-- ALTER TABLE plan_allocations ADD CONSTRAINT check_asset_or_ticker_or_alias CHECK (
--     asset_id IS NOT NULL OR ticker IS NOT NULL OR alias IS NOT NULL
-- );

-- 배분 그룹 테이블 (신규)
CREATE TABLE IF NOT EXISTS allocation_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES rebalance_plans(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_allocation_groups_plan ON allocation_groups(plan_id);
CREATE INDEX IF NOT EXISTS idx_allocation_group_items_group ON allocation_group_items(group_id);

-- 트리거가 없으면 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_allocation_groups_updated_at') THEN
        CREATE TRIGGER update_allocation_groups_updated_at
            BEFORE UPDATE ON allocation_groups
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- ============================================
-- 벤치마크 히스토리 테이블 (v0.6.0)
-- KOSPI, S&P 500, NASDAQ 일별 종가 저장 냥~
-- ============================================
CREATE TABLE IF NOT EXISTS benchmark_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) NOT NULL,        -- '^KS11' (KOSPI), '^GSPC' (S&P 500), '^IXIC' (NASDAQ)
    snapshot_date DATE NOT NULL,
    close_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_benchmark_ticker_date UNIQUE (ticker, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_history_ticker_date ON benchmark_history(ticker, snapshot_date);

-- ============================================
-- 사용자 설정 테이블 (v0.8.0)
-- 리밸런싱 허용 오차 등 사용자 설정 저장 냥~
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',  -- 단일 사용자 고정 ID
    alert_threshold DECIMAL(5, 2) NOT NULL DEFAULT 5.0,       -- 알림 기준 (%)
    calculator_tolerance DECIMAL(5, 2) NOT NULL DEFAULT 5.0,  -- 계산기 기본값 (%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_user_settings UNIQUE (user_id),
    CONSTRAINT check_alert_threshold CHECK (alert_threshold >= 0 AND alert_threshold <= 20),
    CONSTRAINT check_calculator_tolerance CHECK (calculator_tolerance >= 0 AND calculator_tolerance <= 20)
);

-- 기본 설정 생성
INSERT INTO user_settings (user_id, alert_threshold, calculator_tolerance)
VALUES ('00000000-0000-0000-0000-000000000001', 5.0, 5.0)
ON CONFLICT (user_id) DO NOTHING;

-- 트리거
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_settings_updated_at') THEN
        CREATE TRIGGER update_user_settings_updated_at
            BEFORE UPDATE ON user_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;
