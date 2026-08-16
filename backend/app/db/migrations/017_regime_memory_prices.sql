CREATE TABLE IF NOT EXISTS memory_price_observations (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  market_type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  period_label TEXT,
  price_high REAL,
  price_low REAL,
  price_average REAL NOT NULL,
  change_percent REAL,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  UNIQUE(series_id, observation_date)
);

CREATE TABLE IF NOT EXISTS memory_price_fetch_status (
  source TEXT PRIMARY KEY,
  last_attempted_at TEXT NOT NULL,
  last_success_at TEXT,
  status TEXT NOT NULL,
  observation_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

ALTER TABLE regime_snapshots ADD COLUMN memory_cycle_json TEXT;

CREATE INDEX IF NOT EXISTS idx_memory_price_series_date
  ON memory_price_observations(series_id, observation_date DESC);
