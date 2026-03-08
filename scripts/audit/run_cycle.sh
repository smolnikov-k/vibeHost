#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-"https://hostingvibe.ru"}
API_URL=${API_URL:-"${BASE_URL%/}/api"}
AUDIT_CHECK_DB=${AUDIT_CHECK_DB:-0}
PASS=true
WARNINGS=0

log_ok()   { printf "[OK]   %s\n" "$1"; }
log_fail() { printf "[FAIL] %s\n" "$1"; PASS=false; }
log_warn() { printf "[WARN] %s\n" "$1"; WARNINGS=$((WARNINGS+1)); }

check_http() {
  local name="$1" url="$2" expected="${3:-200}"
  local code
  code=$(curl -k -s -o /tmp/audit_body.$$ -w '%{http_code}' "$url" || true)
  if [[ "$code" == "$expected" ]]; then
    log_ok "$name ($url) => $code"
  else
    log_fail "$name ($url) => $code, expected $expected"
  fi
}

check_contains() {
  local name="$1" url="$2" needle="$3"
  local body
  body=$(curl -k -s "$url" || true)
  if echo "$body" | grep -q "$needle"; then
    log_ok "$name contains: $needle"
  else
    log_fail "$name missing: $needle"
  fi
}

check_header() {
  local name="$1" url="$2" header="$3"
  local out
  out=$(curl -k -s -I "$url" || true)
  if echo "$out" | grep -qi "$header"; then
    log_ok "$name header present: $header"
  else
    log_fail "$name header missing: $header"
  fi
}

check_env_presence() {
  local file="$1" key="$2" label="$3"
  if [[ -f "$file" ]] && grep -q "^$key=" "$file" && [[ -n "$(grep "^$key=" "$file" | cut -d'=' -f2-)" ]]; then
    log_ok "$label configured"
  else
    log_fail "$label missing"
  fi
}

check_billing_constant() {
  if grep -q "const PRO_PRICE_RUB = 386" backend/src/routes/billing.ts 2>/dev/null; then
    log_ok "billing constant PRO_PRICE_RUB=386"
  else
    log_fail "billing constant mismatch"
  fi
}

check_db_optional() {
  local env_file="backend/.env"
  if [[ "$AUDIT_CHECK_DB" != "1" ]]; then
    log_warn "DB invariants skipped (set AUDIT_CHECK_DB=1 to enable)"
    return
  fi
  if ! command -v psql >/dev/null 2>&1; then
    log_warn "psql not found, skipping DB invariants"
    return
  fi
  if [[ ! -f "$env_file" ]]; then
    log_warn "backend/.env not found, skipping DB invariants"
    return
  fi

  local db_url
  db_url=$(grep '^DATABASE_URL=' "$env_file" | cut -d'=' -f2- | sed 's/^"//;s/"$//' || true)
  if [[ -z "$db_url" ]]; then
    log_warn "DATABASE_URL empty, skipping DB invariants"
    return
  fi

  local count_active_zero
  if count_active_zero=$(psql "$db_url" -t -A -c "SELECT count(*) FROM subscriptions WHERE status='ACTIVE' AND price_rub=0;" 2>/dev/null); then
    if [[ "$count_active_zero" == "0" ]]; then
      log_ok "DB invariant: no ACTIVE subscriptions with price_rub=0"
    else
      log_fail "DB invariant broken: ACTIVE subscriptions with price_rub=0 => $count_active_zero"
    fi
  else
    log_warn "Cannot query subscriptions invariant (DB inaccessible?)"
  fi

  local tables_count
  if tables_count=$(psql "$db_url" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('email_events','payment_events');" 2>/dev/null); then
    if [[ "$tables_count" == "2" ]]; then
      log_ok "DB invariant: email_events/payment_events tables exist"
    else
      log_fail "DB invariant broken: expected 2 tables, got $tables_count"
    fi
  else
    log_warn "Cannot query email/payment events tables"
  fi
}

# 1) Availability
check_http "Landing" "$BASE_URL/" 200
check_http "API health" "$API_URL/health" 200
check_header "API health" "$API_URL/health" "x-request-id"

# 2) SEO/meta invariants
check_contains "Landing meta" "$BASE_URL/" "<link rel=\"canonical\""
check_contains "Docs canonical" "$BASE_URL/docs" "href=\"https://hostingvibe.ru/docs\""
check_contains "Gallery canonical" "$BASE_URL/gallery" "href=\"https://hostingvibe.ru/gallery\""
check_contains "Sitemap" "$BASE_URL/sitemap.xml" "https://hostingvibe.ru/ai"

# 3) Smoke endpoints
check_http "Gallery tags" "$API_URL/gallery/meta/tags" 200
check_http "Slug check" "$API_URL/slugs/check?slug=audit-cycle-probe" 200
check_http "Forms JS" "$API_URL/vibe-forms.js" 200
check_http "Editor bridge" "$API_URL/vibe-editor-bridge.js" 200

# 4) Config sanity (no secret prints)
check_env_presence "backend/.env" "SMTP_HOST" "SMTP host"
check_env_presence "backend/.env" "SMTP_FROM" "SMTP from"
check_billing_constant

# 5) Optional DB invariants
check_db_optional

if $PASS; then
  log_ok "Audit cycle PASS${WARNINGS:+ (warnings: $WARNINGS)}"
else
  log_fail "Audit cycle FAIL${WARNINGS:+ (warnings: $WARNINGS)}"
  exit 1
fi
