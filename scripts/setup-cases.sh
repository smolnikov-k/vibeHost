#!/bin/bash
set -e

SITES="/var/www/vibe-hosting/sites"
CASES="/root/vibecode/vibe-hosting/cases"
CASES_EMAIL="${VIBE_CASES_EMAIL:-cases@hostingvibe.ru}"
CASES_PASS="${VIBE_CASES_PASS:?Set VIBE_CASES_PASS env variable}"
DB_PASS="${VIBE_DB_PASS:?Set VIBE_DB_PASS env variable}"

# Register user via API
REGISTER_RESULT=$(curl -s -X POST http://127.0.0.1:7001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CASES_EMAIL\",\"password\":\"$CASES_PASS\"}" 2>/dev/null || true)
echo "Register: $REGISTER_RESULT"

# Login to get token
LOGIN_RESULT=$(curl -s -X POST http://127.0.0.1:7001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CASES_EMAIL\",\"password\":\"$CASES_PASS\"}")
echo "Login: $LOGIN_RESULT"

TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."

# Upgrade to PRO via DB
PGPASSWORD="$DB_PASS" psql -U vibe_user -d vibe_hosting -h localhost -c \
  "UPDATE users SET plan = 'PRO', storage_limit = 1073741824 WHERE email = '$CASES_EMAIL';"

# Create projects via API and deploy files manually
declare -A CASE_MAP
CASE_MAP[case-marketing]="marketing:SPARK Agency - Вебинар"
CASE_MAP[case-design]="design:Анна Смирнова - UX/UI Дизайнер"
CASE_MAP[case-dev]="dev:Дмитрий Козлов - Разработчик"
CASE_MAP[case-student]="students:Алексей Волков - Портфолио"
CASE_MAP[case-coffee]="business:Brew and Co - Кофейня"
CASE_MAP[case-freelance]="freelance:Pixelcraft Studio"

for SLUG in case-marketing case-design case-dev case-student case-coffee case-freelance; do
  IFS=':' read -r DIR TITLE <<< "${CASE_MAP[$SLUG]}"

  # Create project via API
  CREATE_RESULT=$(curl -s -X POST http://127.0.0.1:7001/api/projects \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"title\":\"$TITLE\",\"slug\":\"$SLUG\"}" 2>/dev/null || true)
  echo "Create $SLUG: $CREATE_RESULT"

  # Deploy files directly
  SITE_DIR="$SITES/$SLUG"
  SRC="$CASES/$DIR/index.html"
  if [ -f "$SRC" ]; then
    mkdir -p "$SITE_DIR"
    cp "$SRC" "$SITE_DIR/index.html"
    chmod 755 "$SITE_DIR"
    chmod 644 "$SITE_DIR/index.html"
    echo "Deployed $SLUG"

    # Update project status to LIVE
    PGPASSWORD="$DB_PASS" psql -U vibe_user -d vibe_hosting -h localhost -c \
      "UPDATE projects SET status = 'LIVE', is_public = true, published_at = NOW() WHERE slug = '$SLUG';" 2>/dev/null || true
  else
    echo "SKIP: $SRC not found"
  fi
done

echo "Done!"
