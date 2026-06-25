# Runbook: Fix ACTIVE subscriptions with `price_rub = 0`

## Scope
One-time production fix for billing anomaly:
- `subscriptions.status = 'ACTIVE'`
- `subscriptions.price_rub = 0`

Target value: `386`.

## Prerequisites
- Access to production DB (`DATABASE_URL`)
- `psql` installed

## 1) Dry check (before)
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS active_zero_price
FROM subscriptions
WHERE status='ACTIVE' AND price_rub=0;
"
```

## 2) Apply fix
```bash
psql "$DATABASE_URL" -f backend/scripts/sql/fix_active_subscription_price_rub.sql
```

## 3) Verify (after)
```bash
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS active_zero_price
FROM subscriptions
WHERE status='ACTIVE' AND price_rub=0;
"
```
Expected: `0`.

## Notes
- Script is **idempotent**: repeated runs are safe.
- API contract is unchanged; fix only normalizes DB data.
