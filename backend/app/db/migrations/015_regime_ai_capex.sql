CREATE TABLE IF NOT EXISTS company_filings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cik TEXT NOT NULL,
  accession_number TEXT NOT NULL,
  form TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  report_period TEXT,
  primary_document TEXT,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(company_id, accession_number)
);

CREATE TABLE IF NOT EXISTS company_facts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  unit TEXT NOT NULL,
  value REAL NOT NULL,
  period_start TEXT,
  period_end TEXT NOT NULL,
  fiscal_year INTEGER,
  fiscal_period TEXT,
  form TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  accession_number TEXT NOT NULL,
  frame TEXT,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(company_id, concept, accession_number, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS company_metrics (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_end TEXT NOT NULL,
  fiscal_year INTEGER,
  fiscal_period TEXT,
  value REAL,
  unit TEXT NOT NULL,
  derivation TEXT NOT NULL,
  source_accessions_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  UNIQUE(company_id, metric, period_end)
);

CREATE TABLE IF NOT EXISTS company_fetch_status (
  company_id TEXT PRIMARY KEY,
  last_attempted_at TEXT NOT NULL,
  last_success_at TEXT,
  status TEXT NOT NULL,
  retry_after TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_company_filings_company_filed
  ON company_filings(company_id, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_facts_company_concept_period
  ON company_facts(company_id, concept, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_company_metrics_metric_period
  ON company_metrics(metric, period_end DESC);

