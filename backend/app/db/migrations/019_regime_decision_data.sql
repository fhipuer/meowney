PRAGMA foreign_keys = ON;

-- The previous retail series (RSAFS) is nominal.  Remove only that derived
-- cache before switching the same logical indicator to inflation-adjusted
-- retail sales so values with different units can never share a history.
DELETE FROM regime_observation_vintages WHERE indicator_id = 'us_retail';
DELETE FROM regime_observations WHERE indicator_id = 'us_retail';
DELETE FROM regime_indicator_fetch_status WHERE indicator_id = 'us_retail';

UPDATE regime_indicators
SET name = '미국 실질 소매판매',
    source_key = 'RRSFS',
    unit = '백만 1982-84 달러'
WHERE id = 'us_retail';

-- SGOV itself is an ETF and has fees/market-price effects.  DGS3MO is the
-- official daily Treasury-rate proxy used only as portfolio context.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('us3m','rates','미국 국채 3M (SGOV 프록시)','fred','DGS3MO','%','daily','up_bad',0.5);
