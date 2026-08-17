ALTER TABLE regime_review_acknowledgments ADD COLUMN assessment_fingerprint TEXT;
ALTER TABLE regime_review_acknowledgments ADD COLUMN candidate_regime TEXT;
ALTER TABLE regime_review_acknowledgments ADD COLUMN urgency TEXT;

CREATE TABLE IF NOT EXISTS regime_feed_status (
  source TEXT PRIMARY KEY,
  last_attempted_at TEXT NOT NULL,
  last_success_at TEXT,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_regime_feed_status_success
  ON regime_feed_status(last_success_at DESC);
