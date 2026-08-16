-- FRED에는 안정적으로 조회 가능한 KOSPI series가 없으므로 기존 yfinance/benchmark cache를 사용한다.
UPDATE regime_indicators SET enabled=0 WHERE id='market_kospi';
