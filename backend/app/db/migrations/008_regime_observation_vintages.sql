PRAGMA foreign_keys = ON;

-- Point-in-time macro data.  This table is append-only in normal operation;
-- regime_observations remains the latest-value projection used by the legacy path.
CREATE TABLE IF NOT EXISTS regime_observation_vintages (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES regime_indicators(id) ON DELETE CASCADE,
  observation_date TEXT NOT NULL,
  value NUMERIC NOT NULL,
  available_from TEXT NOT NULL,
  available_until TEXT,
  release_date TEXT,
  fetched_at TEXT NOT NULL,
  fetch_run_id TEXT REFERENCES regime_fetch_runs(id),
  source TEXT NOT NULL,
  source_url TEXT,
  quality_status TEXT NOT NULL DEFAULT 'official',
  vintage_kind TEXT NOT NULL DEFAULT 'revision',
  previous_value NUMERIC,
  revision_delta NUMERIC,
  UNIQUE(indicator_id, observation_date, available_from)
);

CREATE INDEX IF NOT EXISTS idx_regime_vintages_point_in_time
  ON regime_observation_vintages(indicator_id, available_from, available_until, observation_date);

CREATE INDEX IF NOT EXISTS idx_regime_vintages_observation
  ON regime_observation_vintages(indicator_id, observation_date, available_from DESC);
