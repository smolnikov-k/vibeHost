-- Fix subscriptions with invalid PRO price (idempotent)
-- Pre-check counts
SELECT COUNT(*) AS pending_fix
FROM subscriptions
WHERE status = 'ACTIVE' AND (price_rub = 0 OR price_rub IS NULL);

-- Inspect affected rows (optional)
SELECT id, user_id, status, price_rub, current_period_end, updated_at
FROM subscriptions
WHERE status = 'ACTIVE' AND (price_rub = 0 OR price_rub IS NULL)
ORDER BY updated_at DESC
LIMIT 50;

-- Apply normalization
UPDATE subscriptions
SET price_rub = 386
WHERE status = 'ACTIVE' AND (price_rub = 0 OR price_rub IS NULL);

-- Post-check counts
SELECT COUNT(*) AS remaining_bad
FROM subscriptions
WHERE status = 'ACTIVE' AND (price_rub = 0 OR price_rub IS NULL);

-- Verify sample
SELECT id, user_id, status, price_rub, current_period_end, updated_at
FROM subscriptions
WHERE status = 'ACTIVE'
ORDER BY updated_at DESC
LIMIT 20;
