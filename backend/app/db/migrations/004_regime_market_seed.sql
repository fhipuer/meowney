INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
 ('market_kospi','시장·밸류에이션','KOSPI','fred','KOSPI','지수','daily','neutral',0),
 ('market_sp500','시장·밸류에이션','S&P 500','fred','SP500','지수','daily','neutral',0),
 ('market_nasdaq','시장·밸류에이션','NASDAQ','fred','NASDAQCOM','지수','daily','neutral',0),
 ('market_vix','시장·밸류에이션','VIX','fred','VIXCLS','지수','daily','neutral',0),
 ('market_usdkrw','시장·밸류에이션','USD/KRW','fred','DEXKOUS','원','daily','neutral',0),
 ('market_dollar','시장·밸류에이션','미국 달러지수(광의)','fred','DTWEXBGS','지수','daily','neutral',0);
