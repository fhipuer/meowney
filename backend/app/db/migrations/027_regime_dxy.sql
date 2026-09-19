-- 익숙한 시장 체감 지표인 ICE U.S. Dollar Index(DXY)를 추가한다.
-- 글로벌 달러 금융여건의 보조 확인은 기존 Fed 광의 달러지수(DTWEXBGS)가
-- 담당하며, 두 지표 모두 자동 거시 레짐 점수에는 합산하지 않는다.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('market_dxy','시장·밸류에이션','ICE 미국 달러지수 DXY','yfinance','DX-Y.NYB','지수','daily','neutral',0);
