CREATE TABLE IF NOT EXISTS regime_triggers (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL UNIQUE,
  rule_version TEXT NOT NULL,
  domain TEXT NOT NULL,
  severity TEXT NOT NULL,
  direction TEXT NOT NULL,
  evidence_cluster TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  first_fired_at TEXT NOT NULL,
  last_fired_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS review_assessments (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL REFERENCES regime_evaluations(id),
  assessed_at TEXT NOT NULL,
  urgency TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  coverage_json TEXT NOT NULL,
  trigger_rule_version TEXT NOT NULL,
  UNIQUE(evaluation_id, trigger_rule_version)
);

CREATE TABLE IF NOT EXISTS regime_review_acknowledgments (
  id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL,
  evaluation_id TEXT NOT NULL REFERENCES regime_evaluations(id),
  trigger_state_json TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS regime_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  scheduled_at TEXT,
  released_at TEXT,
  importance TEXT NOT NULL DEFAULT 'medium',
  affected_domains_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  result_json TEXT,
  source TEXT,
  source_url TEXT
);

ALTER TABLE regime_snapshots ADD COLUMN review_urgency TEXT;
ALTER TABLE regime_snapshots ADD COLUMN triggers_json TEXT;
ALTER TABLE regime_snapshots ADD COLUMN coverage_json TEXT;
ALTER TABLE regime_snapshots ADD COLUMN rule_version TEXT;

CREATE INDEX IF NOT EXISTS idx_regime_triggers_active ON regime_triggers(active,severity);
CREATE INDEX IF NOT EXISTS idx_review_ack_completed ON regime_review_acknowledgments(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_regime_events_scheduled ON regime_events(scheduled_at);
