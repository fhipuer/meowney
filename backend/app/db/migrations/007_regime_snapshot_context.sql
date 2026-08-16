ALTER TABLE regime_snapshots ADD COLUMN review_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE regime_snapshots ADD COLUMN as_of_date TEXT;
ALTER TABLE regime_snapshots ADD COLUMN last_fetched_at TEXT;
ALTER TABLE regime_snapshots ADD COLUMN observation_range_json TEXT;
ALTER TABLE regime_snapshots ADD COLUMN macro_quadrant_json TEXT;
