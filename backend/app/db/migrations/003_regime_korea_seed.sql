INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
 ('kr_gdp','growth','한국 실질 GDP','fred','NGDPRSAXDCKRQ','백만원','quarterly','up_good',1.5),
 ('kr_exports','growth','한국 상품 수출','fred','VALEXPKRM052N','백만 달러','monthly','up_good',1),
 ('kr_indpro','growth','한국 산업생산','fred','KORPROINDMISMEI','지수','monthly','up_good',1);
