CREATE TABLE IF NOT EXISTS regime_candidate_confirmations (
  id TEXT PRIMARY KEY,
  candidate_regime TEXT NOT NULL,
  basis_fingerprint TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  UNIQUE(candidate_regime, basis_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_regime_candidate_confirmation_time
  ON regime_candidate_confirmations(observed_at DESC);
