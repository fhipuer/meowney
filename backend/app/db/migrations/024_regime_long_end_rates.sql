PRAGMA foreign_keys = ON;

-- The Treasury curve is published before the corresponding FRED projection
-- is necessarily refreshed. Keep the stable logical ids while moving the
-- nominal and real benchmark yields used by the model to the official source.
UPDATE regime_indicators
SET source = 'treasury',
    source_key = 'BC_10YEAR'
WHERE id = 'us10y';

UPDATE regime_indicators
SET source = 'treasury',
    source_key = 'TC_10YEAR'
WHERE id = 'tips10y';

UPDATE regime_indicators
SET name = '미국 국채 30Y',
    source = 'treasury',
    source_key = 'BC_30YEAR',
    direction = 'up_bad',
    weight = 0.5
WHERE id = 'us30y';

-- The 30-year real yield is used only by the bounded long-end duration alert.
-- It does not become a separate macro domain or replace 10Y TIPS as the main
-- broad financial-restriction input.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('tips30y','rates','미국 30Y 실질금리','treasury','TC_30YEAR','%','daily','up_bad',0.5);
