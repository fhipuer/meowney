PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS regime_indicators (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  unit TEXT,
  frequency TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'neutral',
  weight NUMERIC NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(source, source_key)
);

CREATE TABLE IF NOT EXISTS regime_observations (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES regime_indicators(id) ON DELETE CASCADE,
  observation_date TEXT NOT NULL,
  value NUMERIC NOT NULL,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL,
  UNIQUE(indicator_id, observation_date)
);

CREATE TABLE IF NOT EXISTS regime_fetch_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  observations_saved INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS regime_evaluations (
  id TEXT PRIMARY KEY,
  evaluated_at TEXT NOT NULL,
  data_fingerprint TEXT NOT NULL UNIQUE,
  candidate_regime TEXT NOT NULL,
  automatic_regime TEXT NOT NULL,
  signals_json TEXT NOT NULL,
  domains_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regime_snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  evaluation_id TEXT NOT NULL REFERENCES regime_evaluations(id),
  automatic_regime TEXT NOT NULL,
  user_regime TEXT,
  user_note TEXT,
  raw_data_json TEXT NOT NULL,
  signals_json TEXT NOT NULL,
  domains_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  portfolio_json TEXT NOT NULL,
  target_plan_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_regime_observations_indicator_date
  ON regime_observations(indicator_id, observation_date DESC);
CREATE INDEX IF NOT EXISTS idx_regime_evaluations_date
  ON regime_evaluations(evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_regime_snapshots_date
  ON regime_snapshots(created_at DESC);

INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
 ('us_gdp','growth','미국 실질 GDP','fred','GDPC1','십억 달러','quarterly','up_good',2),
 ('us_unemployment','growth','미국 실업률','fred','UNRATE','%','monthly','up_bad',2),
 ('us_payrolls','growth','미국 비농업 고용','fred','PAYEMS','천 명','monthly','up_good',2),
 ('us_claims','growth','신규실업수당 4주 평균','fred','IC4WSA','건','weekly','up_bad',1.5),
 ('us_retail','growth','미국 소매판매','fred','RSAFS','백만 달러','monthly','up_good',1),
 ('us_indpro','growth','미국 산업생산','fred','INDPRO','지수','monthly','up_good',1),
 ('cpi','inflation','미국 CPI','fred','CPIAUCSL','지수','monthly','up_bad',1),
 ('core_cpi','inflation','미국 Core CPI','fred','CPILFESL','지수','monthly','up_bad',2),
 ('pce','inflation','미국 PCE','fred','PCEPI','지수','monthly','up_bad',1),
 ('core_pce','inflation','미국 Core PCE','fred','PCEPILFE','지수','monthly','up_bad',2),
 ('ppi','inflation','미국 PPI','fred','PPIACO','지수','monthly','up_bad',1),
 ('wages','inflation','미국 시간당 임금','fred','CES0500000003','달러','monthly','up_bad',1),
 ('fedfunds','rates','Fed 기준금리','fred','FEDFUNDS','%','monthly','up_bad',1),
 ('us2y','rates','미국 국채 2Y','fred','DGS2','%','daily','up_bad',1),
 ('us10y','rates','미국 국채 10Y','fred','DGS10','%','daily','up_bad',2),
 ('us30y','rates','미국 국채 30Y','fred','DGS30','%','daily','up_bad',1),
 ('tips10y','rates','미국 10Y TIPS','fred','DFII10','%','daily','up_bad',2),
 ('bei10y','rates','미국 10Y 기대인플레이션','fred','T10YIE','%','daily','up_bad',1.5),
 ('curve2s10s','rates','미국 2Y-10Y 스프레드','fred','T10Y2Y','%p','daily','up_good',1),
 ('term_premium','rates','미국 10Y Term Premium','fred','THREEFFTP10','%','daily','up_bad',1),
 ('hy_oas','liquidity','미국 HY OAS','fred','BAMLH0A0HYM2','%p','daily','up_bad',2),
 ('ig_oas','liquidity','미국 IG OAS','fred','BAMLC0A0CM','%p','daily','up_bad',1),
 ('nfci','liquidity','미국 금융여건 NFCI','fred','NFCI','지수','weekly','up_bad',2),
 ('fed_assets','liquidity','Fed 자산','fred','WALCL','백만 달러','weekly','up_good',1),
 ('bank_reserves','liquidity','은행 준비금','fred','WRESBAL','십억 달러','weekly','up_good',1),
 ('reverse_repo','liquidity','Reverse Repo','fred','RRPONTSYD','십억 달러','daily','neutral',0.5);
