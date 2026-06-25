#!/bin/bash
# Deploy all case study sites to production
# Run from dev server: bash scripts/deploy-cases.sh

set -e

PROD_HOST="${VIBE_PROD_HOST:-root@203.0.113.10}"
PROD_PASS="${VIBE_PROD_PASS:?Set VIBE_PROD_PASS env variable}"
SITES_DIR="/var/www/vibe-hosting/sites"
CASES_DIR="/root/vibecode/vibe-hosting/cases"

SSH_CMD="sshpass -p '$PROD_PASS' ssh -o StrictHostKeyChecking=no $PROD_HOST"
SCP_CMD="sshpass -p '$PROD_PASS' scp -o StrictHostKeyChecking=no"

# Map of case folders to slugs on hostingvibe.ru
declare -A CASES=(
  # Main 6 cases (created by Claude)
  ["marketing"]="case-marketing"
  ["design"]="case-design"
  ["dev"]="case-dev"
  ["students"]="case-student"
  ["business"]="case-coffee"
  ["freelance"]="case-freelance"
  # Codex 6 cases (alternative versions)
  ["nutrition"]="case-nutrition"
  ["illustrator"]="case-illustrator"
  ["saas"]="case-saas"
  ["hackathon"]="case-hackathon"
  ["barber"]="case-barber"
  ["smm"]="case-smm"
)

echo "=== Deploying case study sites to production ==="
echo ""

for folder in "${!CASES[@]}"; do
  slug="${CASES[$folder]}"
  file="$CASES_DIR/$folder/index.html"

  if [ ! -f "$file" ]; then
    echo "SKIP: $folder/index.html not found"
    continue
  fi

  echo "Deploying $folder -> $slug.hostingvibe.ru ..."

  # Create directory on production
  eval $SSH_CMD "mkdir -p $SITES_DIR/$slug"

  # Copy index.html
  eval $SCP_CMD "$file" "$PROD_HOST:$SITES_DIR/$slug/index.html"

  # Fix permissions for nginx (www-data)
  eval $SSH_CMD "chmod -R o+rX $SITES_DIR/$slug"

  echo "  OK: https://$slug.hostingvibe.ru"
done

echo ""
echo "=== Done! ==="
echo ""
echo "All deployed sites:"
for folder in "${!CASES[@]}"; do
  slug="${CASES[$folder]}"
  echo "  https://$slug.hostingvibe.ru"
done
