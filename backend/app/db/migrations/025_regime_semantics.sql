-- 사용자 화면에는 국가와 실제 데이터 성격이 드러나는 이름을 사용한다.
UPDATE regime_indicators
SET name = '미국 신규실업수당 4주 평균'
WHERE id = 'us_claims';

UPDATE regime_indicators
SET name = '미국 3개월 국채금리'
WHERE id = 'us3m';

-- 재활성된 신호와 오래 지속된 신호를 구분하기 위한 현재 활성 구간 시작 시각.
ALTER TABLE regime_triggers ADD COLUMN current_fired_at TEXT;

UPDATE regime_triggers
SET current_fired_at = first_fired_at
WHERE current_fired_at IS NULL;
