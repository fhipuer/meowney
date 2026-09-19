PRAGMA foreign_keys = ON;

-- FEDFUNDS is the monthly average effective federal funds rate.  It is not
-- the current FOMC target range and must not be labelled as such.
UPDATE regime_indicators
SET name = '실효 연방기금금리 (월평균)'
WHERE id = 'fedfunds';

INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('fed_target_lower','rates','Fed 목표금리 하단','fred','DFEDTARL','%','daily','neutral',0),
  ('fed_target_upper','rates','Fed 목표금리 상단','fred','DFEDTARU','%','daily','neutral',0);

-- BLS official CPI year-over-year releases use not-seasonally-adjusted
-- indexes.  Keep the seasonally-adjusted series for MoM/3M momentum and add
-- explicit NSA companions for the official YoY reading.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('cpi_nsa','inflation','미국 CPI (공식 YoY·NSA)','fred','CPIAUCNS','지수','monthly','neutral',0),
  ('core_cpi_nsa','inflation','미국 Core CPI (공식 YoY·NSA)','fred','CPILFENS','지수','monthly','neutral',0);

-- WRESBAL is published by FRED in millions of dollars.
UPDATE regime_indicators
SET unit = '백만 달러'
WHERE id = 'bank_reserves';
