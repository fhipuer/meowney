PRAGMA foreign_keys = ON;

-- KOSIS, Korea Customs, OpenDART and EIA share the same append/update cache
-- contract.  series_id is application-owned and remains stable even when a
-- provider changes a display label.
CREATE TABLE IF NOT EXISTS regime_external_observations (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  series_id TEXT NOT NULL,
  observation_date TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  released_at TEXT,
  fetched_at TEXT NOT NULL,
  source_url TEXT NOT NULL,
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(series_id, observation_date)
);

CREATE TABLE IF NOT EXISTS regime_external_fetch_status (
  feed_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  dataset TEXT NOT NULL,
  last_attempted_at TEXT NOT NULL,
  last_success_at TEXT,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_regime_external_series_date
  ON regime_external_observations(series_id, observation_date DESC);
CREATE INDEX IF NOT EXISTS idx_regime_external_source_dataset
  ON regime_external_observations(source, dataset, observation_date DESC);
CREATE INDEX IF NOT EXISTS idx_regime_external_status_success
  ON regime_external_fetch_status(last_success_at DESC);

ALTER TABLE regime_snapshots ADD COLUMN semiconductor_cycle_json TEXT;
ALTER TABLE regime_snapshots ADD COLUMN power_cycle_json TEXT;
