CREATE TABLE IF NOT EXISTS regime_indicator_fetch_status (
  indicator_id TEXT PRIMARY KEY REFERENCES regime_indicators(id) ON DELETE CASCADE,
  last_attempted_at TEXT,
  last_success_at TEXT,
  last_observation_date TEXT,
  status TEXT NOT NULL DEFAULT 'never',
  failure_count INTEGER NOT NULL DEFAULT 0,
  retry_after TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_regime_indicator_fetch_retry
  ON regime_indicator_fetch_status(status, retry_after);
