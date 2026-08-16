PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, base_currency TEXT DEFAULT 'KRW',
  target_value NUMERIC, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS asset_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT 'paw',
  display_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES asset_categories(id) ON DELETE SET NULL, name TEXT NOT NULL, ticker TEXT,
  asset_type TEXT NOT NULL DEFAULT 'stock', quantity NUMERIC NOT NULL DEFAULT 0,
  average_price NUMERIC NOT NULL DEFAULT 0, currency TEXT DEFAULT 'KRW', current_value NUMERIC,
  purchase_exchange_rate NUMERIC, notes TEXT, is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS asset_history (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL, total_value NUMERIC NOT NULL, total_principal NUMERIC NOT NULL,
  total_profit NUMERIC NOT NULL, profit_rate NUMERIC, category_breakdown TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(portfolio_id, snapshot_date)
);
CREATE TABLE IF NOT EXISTS target_allocations (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
  target_percentage NUMERIC NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(portfolio_id, category_id)
);
CREATE TABLE IF NOT EXISTS rebalance_plans (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, strategy_prompt TEXT, is_main INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plan_allocations (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES rebalance_plans(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE, ticker TEXT, target_percentage NUMERIC NOT NULL,
  display_name TEXT, alias TEXT, absolute_band NUMERIC, relative_band NUMERIC,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS allocation_groups (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES rebalance_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL, target_percentage NUMERIC NOT NULL, display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS allocation_group_items (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES allocation_groups(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL, ticker TEXT, alias TEXT, weight NUMERIC DEFAULT 100,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS benchmark_history (
  id TEXT PRIMARY KEY, ticker TEXT NOT NULL, snapshot_date TEXT NOT NULL, close_price NUMERIC NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(ticker, snapshot_date)
);
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE DEFAULT '00000000-0000-0000-0000-000000000001',
  alert_threshold NUMERIC NOT NULL DEFAULT 5, calculator_tolerance NUMERIC NOT NULL DEFAULT 5,
  default_absolute_band NUMERIC NOT NULL DEFAULT 5, default_relative_band NUMERIC NOT NULL DEFAULT 25,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assets_portfolio_id ON assets(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_portfolio_date ON asset_history(portfolio_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_plans_portfolio ON rebalance_plans(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_allocations_plan ON plan_allocations(plan_id);
CREATE INDEX IF NOT EXISTS idx_groups_plan ON allocation_groups(plan_id);
CREATE INDEX IF NOT EXISTS idx_group_items_group ON allocation_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_ticker_date ON benchmark_history(ticker, snapshot_date);

INSERT OR IGNORE INTO portfolios(id, name, description)
VALUES ('00000000-0000-0000-0000-000000000010', 'My Meowney Portfolio', '냥이 집사의 기본 포트폴리오');
INSERT OR IGNORE INTO asset_categories(id, name, color, icon, display_order) VALUES
 ('00000000-0000-0000-0000-000000000101','국내주식','#ef4444','cat',1),
 ('00000000-0000-0000-0000-000000000102','해외주식','#3b82f6','fish',2),
 ('00000000-0000-0000-0000-000000000103','현금','#22c55e','coins',3),
 ('00000000-0000-0000-0000-000000000104','채권','#f59e0b','shield',4),
 ('00000000-0000-0000-0000-000000000105','암호화폐','#8b5cf6','sparkles',5),
 ('00000000-0000-0000-0000-000000000106','기타','#6b7280','box',6);
INSERT OR IGNORE INTO user_settings(id, user_id)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
