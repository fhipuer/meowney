PRAGMA foreign_keys = ON;

-- PPIACO는 원자재 단계의 비계절조정 상품가격지수다. 기존 이력은 맥락
-- 지표로 보존하고, 자동 물가 판정에는 BLS 헤드라인과 같은 최종수요 PPI
-- (PPIFIS)를 사용한다.
UPDATE regime_indicators
SET name = '미국 최종수요 PPI', source_key = 'PPIFIS', unit = '지수', weight = 1
WHERE id = 'ppi';

INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('ppi_commodities','inflation','미국 상품 PPI (원자재 단계)','fred','PPIACO','지수','monthly','up_bad',0);

UPDATE regime_observations
SET indicator_id = 'ppi_commodities'
WHERE indicator_id = 'ppi';

UPDATE regime_observation_vintages
SET indicator_id = 'ppi_commodities'
WHERE indicator_id = 'ppi';

UPDATE regime_indicator_fetch_status
SET indicator_id = 'ppi_commodities'
WHERE indicator_id = 'ppi';

-- 유가 상승만으로 공급충격을 단정하지 않기 위해 원유 변동성을 별도
-- 확인축으로 둔다. 실제 공급 확인은 EIA 상업용 원유재고가 담당한다.
INSERT OR IGNORE INTO regime_indicators
  (id, domain, name, source, source_key, unit, frequency, direction, weight)
VALUES
  ('market_ovx','시장·밸류에이션','원유 변동성 OVX','fred','OVXCLS','지수','daily','neutral',0);

ALTER TABLE regime_snapshots ADD COLUMN energy_shock_json TEXT;
