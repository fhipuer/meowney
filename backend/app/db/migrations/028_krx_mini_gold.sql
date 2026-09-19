-- 사용자가 확인한 기존 국내 금현물 자산을 KRX 미니금 자동 시세에 연결한다.
-- current_value는 KRX API 장애 또는 승인 대기 중 사용할 수동 폴백으로 보존한다.
UPDATE assets
SET ticker = 'M04020100', updated_at = CURRENT_TIMESTAMP
WHERE asset_type = 'gold'
  AND ticker IS NULL
  AND name = '국내 금현물'
  AND is_active = 1;
