INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
 ('market_wti','시장·밸류에이션','WTI 유가','fred','DCOILWTICO','달러/배럴','daily','neutral',0),
 ('market_copper','시장·밸류에이션','구리 가격','fred','PCOPPUSDM','달러/톤','monthly','neutral',0);
