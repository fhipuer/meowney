PRAGMA foreign_keys = ON;

-- THREEFFTP10 is the instantaneous forward term premium ten years hence.
-- The dashboard needs the term premium embedded in a current ten-year
-- zero-coupon bond, so reset the derived cache before changing the contract.
DELETE FROM regime_observation_vintages WHERE indicator_id = 'term_premium';
DELETE FROM regime_observations WHERE indicator_id = 'term_premium';
DELETE FROM regime_indicator_fetch_status WHERE indicator_id = 'term_premium';

UPDATE regime_indicators
SET name = '미국 10Y 기간 프리미엄 (Kim-Wright)',
    source_key = 'THREEFYTP10',
    direction = 'neutral',
    weight = 0.5
WHERE id = 'term_premium';

-- T10Y2Y is conventionally long minus short.  Keep the stable logical id for
-- snapshot compatibility while making the sign explicit in the user label.
UPDATE regime_indicators
SET name = '미국 10Y-2Y 스프레드'
WHERE id = 'curve2s10s';

-- New York Fed's leading-indicator model uses the 10Y minus 3M spread.  FRED
-- publishes the already-aligned daily spread, avoiding date-join ambiguity.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('curve10y3m','rates','미국 10Y-3M 스프레드','fred','T10Y3M','%p','daily','up_good',2);
