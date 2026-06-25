#!/usr/bin/env bash
# End-to-end deployment test for VibeHosting
# Tests: register -> login -> create project -> deploy ZIP -> verify site -> gallery
# Usage: bash scripts/e2e-deploy-test.sh

set -o pipefail

API="http://127.0.0.1:7001/api"
NGINX="http://127.0.0.1:80"
TIMESTAMP=$(date +%s)
EMAIL="e2e-test-${TIMESTAMP}@vibetest.local"
PASSWORD="TestPass123"
SLUG="e2e-test-${TIMESTAMP}"
TMP_DIR=$(mktemp -d)
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
info()  { printf '\033[36m%s\033[0m\n' "$1"; }

check() {
  local desc="$1" result="$2" expect="$3"
  if [ "$result" = "$expect" ]; then
    green "  PASS: $desc"
    PASS=$((PASS+1))
  else
    red "  FAIL: $desc (got: $result, expected: $expect)"
    FAIL=$((FAIL+1))
  fi
}

info "=== VibeHosting E2E Deploy Test ==="
info "Timestamp: $TIMESTAMP"
info "Email: $EMAIL"
info "Slug: $SLUG"
echo ""

# --- Create test site files ---
info "[ Building test site ZIP ]"
mkdir -p "$TMP_DIR/site"
cat > "$TMP_DIR/site/index.html" << 'HTML'
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E2E Test Site</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<h1>E2E Test — VibeHosting</h1>
<p>Deployed via automated end-to-end test.</p>
</body>
</html>
HTML
cat > "$TMP_DIR/site/style.css" << 'CSS'
body{font-family:Arial,sans-serif;padding:40px;background:#f0f4ff;color:#1a2a3a}
h1{color:#2563eb}
CSS
(cd "$TMP_DIR/site" && zip -q "$TMP_DIR/site.zip" index.html style.css)
green "  Site ZIP created: $TMP_DIR/site.zip"
echo ""

# --- Step 1: Register ---
info "[ Step 1: Register user ]"
REGISTER=$(curl -s -X POST "${API}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"displayName\":\"E2E Tester\"}")
TOKEN=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
USER_ID=$(echo "$REGISTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))" 2>/dev/null)
check "Register returns token" "$([ -n "$TOKEN" ] && echo yes || echo no)" "yes"
check "Register returns user id" "$([ -n "$USER_ID" ] && echo yes || echo no)" "yes"
echo ""

# --- Step 2: Login ---
info "[ Step 2: Login ]"
LOGIN=$(curl -s -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
LOGIN_TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
check "Login returns token" "$([ -n "$LOGIN_TOKEN" ] && echo yes || echo no)" "yes"
echo ""

# --- Step 3: Create project ---
info "[ Step 3: Create project (slug: $SLUG) ]"
PROJECT=$(curl -s -X POST "${API}/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"title\":\"E2E Test Site\",\"slug\":\"${SLUG}\",\"description\":\"Automated e2e test\"}")
PROJECT_ID=$(echo "$PROJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('project',d); print(p.get('id',''))" 2>/dev/null)
PROJECT_SLUG=$(echo "$PROJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('project',d); print(p.get('slug',''))" 2>/dev/null)
check "Project created with ID" "$([ -n "$PROJECT_ID" ] && echo yes || echo no)" "yes"
check "Project slug matches" "$PROJECT_SLUG" "$SLUG"
echo ""

# --- Step 4: Deploy ZIP ---
info "[ Step 4: Deploy ZIP ]"
DEPLOY=$(curl -s -X POST "${API}/projects/${PROJECT_ID}/deploy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TMP_DIR}/site.zip")
DEPLOY_ID=$(echo "$DEPLOY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deploymentId',''))" 2>/dev/null)
DEPLOY_STATUS=$(echo "$DEPLOY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
check "Deploy returns deploymentId" "$([ -n "$DEPLOY_ID" ] && echo yes || echo no)" "yes"
check "Deploy initial status is PENDING or LIVE" "$(echo "$DEPLOY_STATUS" | grep -E 'PENDING|LIVE' | head -1 | tr -d '\n')" "$(echo "$DEPLOY_STATUS")"
echo ""

# --- Wait for deploy to complete ---
sleep 4

# --- Step 5: Verify project is LIVE ---
info "[ Step 5: Verify project status ]"
PROJ_STATUS=$(curl -s "${API}/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
check "Project status is LIVE" "$PROJ_STATUS" "LIVE"
echo ""

# --- Step 6: Verify site accessible via Nginx ---
info "[ Step 6: Verify site accessible at ${SLUG}.hostingvibe.ru ]"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Host: ${SLUG}.hostingvibe.ru" "${NGINX}/")
check "index.html HTTP 200" "$HTTP_CODE" "200"

CSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Host: ${SLUG}.hostingvibe.ru" "${NGINX}/style.css")
check "style.css HTTP 200" "$CSS_CODE" "200"
echo ""

# --- Step 7: Gallery ---
info "[ Step 7: Gallery listing ]"
# Make public first
curl -s -X PUT "${API}/projects/${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"isPublic\":true,\"title\":\"E2E Test Site\"}" > /dev/null

GALLERY=$(curl -s "${API}/gallery" -H "Authorization: Bearer ${TOKEN}")
GALLERY_COUNT=$(echo "$GALLERY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('projects', d.get('items', [])))))" 2>/dev/null)
check "Gallery returns at least 1 item" "$([ "${GALLERY_COUNT:-0}" -ge 1 ] && echo yes || echo no)" "yes"
echo ""

# --- Summary ---
TOTAL=$((PASS+FAIL))
info "=== Results: $PASS/$TOTAL passed ==="
if [ "$FAIL" -eq 0 ]; then
  green "All checks passed. Full deploy flow is working."
else
  red "$FAIL check(s) failed."
fi

# Cleanup
rm -rf "$TMP_DIR"

exit $FAIL
