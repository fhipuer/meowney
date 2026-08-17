ALTER TABLE regime_events ADD COLUMN scheduled_date TEXT;
ALTER TABLE regime_events ADD COLUMN time_precision TEXT NOT NULL DEFAULT 'datetime';

UPDATE regime_events
SET scheduled_date = substr(scheduled_at, 1, 10)
WHERE scheduled_date IS NULL AND scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_regime_events_date
  ON regime_events(scheduled_date, status);
