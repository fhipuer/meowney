ALTER TABLE regime_snapshots ADD COLUMN input_fingerprint TEXT;
ALTER TABLE regime_snapshots ADD COLUMN assessment_fingerprint TEXT;
ALTER TABLE regime_snapshots ADD COLUMN feed_health_json TEXT;
ALTER TABLE regime_snapshots ADD COLUMN snapshot_schema_version TEXT NOT NULL DEFAULT '1';

CREATE INDEX IF NOT EXISTS idx_regime_snapshots_input_fingerprint
  ON regime_snapshots(input_fingerprint);
