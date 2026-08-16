-- KOSPI is not available through FRED. Refresh it into the same observation
-- cache through the existing yfinance adapter instead of fetching it per view.
UPDATE regime_indicators
SET source = 'yfinance', source_key = '^KS11', enabled = 1
WHERE id = 'market_kospi';
