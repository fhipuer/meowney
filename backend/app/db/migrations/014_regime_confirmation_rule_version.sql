ALTER TABLE regime_candidate_confirmations
  ADD COLUMN rule_version TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_regime_candidate_confirmation_rule
  ON regime_candidate_confirmations(rule_version, observed_at DESC);
