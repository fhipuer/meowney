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
-- 5. target_allocations: 목표 배분 비율
-- 리밸런싱 계산용 목표 비율 설정
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

-- 냥~ 스키마 생성 완료! 🐱✨
