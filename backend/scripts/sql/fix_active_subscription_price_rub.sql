-- One-time safe fix for billing anomaly:
-- ACTIVE subscriptions with price_rub = 0 should be 386 (PRO monthly price).
-- Idempotent: running multiple times is safe.

BEGIN;

-- Pre-check: how many anomalous rows exist right now.
SELECT COUNT(*) AS active_zero_price_before
FROM subscriptions
WHERE status = 'ACTIVE'
  AND price_rub = 0;

-- Optional visibility: which rows are affected.
SELECT id, user_id, status, price_rub, current_period_end
FROM subscriptions
WHERE status = 'ACTIVE'
  AND price_rub = 0
ORDER BY updated_at DESC;

-- One-time correction.
UPDATE subscriptions
SET price_rub = 386,
    updated_at = NOW()
WHERE status = 'ACTIVE'
  AND price_rub = 0;

-- Post-check: must be zero after update.
SELECT COUNT(*) AS active_zero_price_after
FROM subscriptions
WHERE status = 'ACTIVE'
  AND price_rub = 0;

COMMIT;
