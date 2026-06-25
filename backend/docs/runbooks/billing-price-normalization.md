# Billing price normalization (PRO price_rub)

Goal: fix subscriptions that have `price_rub = 0` (or NULL) for ACTIVE PRO users. Valid PRO price is **386 RUB**.

## Pre-check (read-only)
```bash
export DATABASE_URL="<prod-db-url>"  # from backend .env
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS pending_fix FROM subscriptions WHERE status='ACTIVE' AND (price_rub=0 OR price_rub IS NULL);"
psql "$DATABASE_URL" -c "SELECT id, user_id, status, price_rub, current_period_end FROM subscriptions WHERE status='ACTIVE' AND (price_rub=0 OR price_rub IS NULL) ORDER BY updated_at DESC LIMIT 20;"
```

## Apply fix (idempotent)
```bash
cd /root/vibecode/vibe-hosting/backend
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/fix_pro_price.sql
```
The script re-runs safely; if nothing is broken it will update 0 rows.

## Post-check
```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS remaining_bad FROM subscriptions WHERE status='ACTIVE' AND (price_rub=0 OR price_rub IS NULL);"
psql "$DATABASE_URL" -c "SELECT id, user_id, price_rub FROM subscriptions WHERE status='ACTIVE' ORDER BY updated_at DESC LIMIT 20;"
```
Expected: `remaining_bad = 0` and `price_rub = 386` for active rows.

## Rollback note
No destructive changes; the update only sets zero/NULL prices to 386. If you must revert for a specific row, adjust `price_rub` manually with an UPDATE, but no global rollback is needed.
