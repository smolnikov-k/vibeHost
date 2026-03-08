# Audit Cycle Runbook

Purpose: repeatable quality sweep (availability, SEO/meta, smoke endpoints, billing/email sanity) without exposing secrets.

## How to run
```bash
cd /root/vibecode/vibe-hosting
# Optional: override URLs
# BASE_URL=https://dev.hostingvibe.ru API_URL=https://dev.hostingvibe.ru/api scripts/audit/run_cycle.sh
scripts/audit/run_cycle.sh
```
Exit code: 0 on PASS, non-zero on FAIL. Output is concise OK/FAIL lines.

## What it checks
- Landing availability: GET / (200)
- Metadata presence: canonical, OG title/description, twitter card
- API health: /api/health returns status=ok (DB/storage/SMTP probes)
- Smoke endpoints: slug availability check, gallery, vibe-forms.js, editor bridge
- Config sanity (non-secret): SMTP_HOST/SMTP_FROM present in backend/.env; billing constant PRO_PRICE_RUB=386 in code

## PASS / FAIL criteria
- PASS: all checks OK
- FAIL: any check fails (availability, meta, health degraded, missing config/billing invariant)

## Escalation / next actions on FAIL
1) Identify failing line from script output
2) If availability/meta/API: check backend logs (`pm2 logs` or `journalctl`), rerun after fix
3) If health degraded: verify DB connectivity or storage path in backend config
4) If SMTP/config missing: update backend/.env (do not commit secrets) and restart service
5) If billing constant mismatch: confirm expected PRO price (should be 386) and align backend code

## Suggested cadence
- Run before each release
- Run after infra changes (domains, TLS, SMTP)
- Schedule nightly in CI/cron (store output to file/slack)
