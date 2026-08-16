INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
 ('market_gold','시장·밸류에이션','금 선물','yfinance','GC=F','달러/온스','daily','neutral',0),
 ('market_silver','시장·밸류에이션','은 선물','yfinance','SI=F','달러/온스','daily','neutral',0),
 ('market_gold_silver_ratio','시장·밸류에이션','금은비','derived','gold/silver','배','daily','neutral',0);
