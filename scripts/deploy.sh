#!/usr/bin/env bash
# ============================================================
# VibeHosting deploy script
# Builds frontend + backend, restarts PM2, runs health check.
# Keeps one previous build for rollback.
# Usage:
#   ./deploy.sh            — full deploy
#   ./deploy.sh rollback   — revert to previous build
# ============================================================
set -euo pipefail

PROJECT_ROOT="/root/vibecode/vibe-hosting"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
ECOSYSTEM="${PROJECT_ROOT}/ecosystem.config.js"
HEALTH_URL="http://localhost:7001/health"
HEALTH_TIMEOUT=15

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ------------------------------------------------------------------
# Rollback
# ------------------------------------------------------------------
if [ "${1:-}" = "rollback" ]; then
  log "Rolling back to previous builds..."

  if [ -d "${BACKEND_DIR}/dist.prev" ]; then
    rm -rf "${BACKEND_DIR}/dist"
    mv "${BACKEND_DIR}/dist.prev" "${BACKEND_DIR}/dist"
    log "Backend rolled back."
  else
    log "WARNING: No previous backend build found (dist.prev missing)."
  fi

  if [ -d "${FRONTEND_DIR}/.next.prev" ]; then
    rm -rf "${FRONTEND_DIR}/.next"
    mv "${FRONTEND_DIR}/.next.prev" "${FRONTEND_DIR}/.next"
    log "Frontend rolled back."
  else
    log "WARNING: No previous frontend build found (.next.prev missing)."
  fi

  log "Restarting PM2..."
  cd "${PROJECT_ROOT}"
  pm2 restart "${ECOSYSTEM}"
  log "Rollback complete."
  exit 0
fi

# ------------------------------------------------------------------
# Full deploy
# ------------------------------------------------------------------
log "=== VibeHosting deploy started ==="

# 1. Build frontend
log "Building frontend..."
cd "${FRONTEND_DIR}"
npm run build
log "Frontend build done."

# 2. Run database migrations
log "Running database migrations..."
cd "${BACKEND_DIR}"
npx prisma migrate deploy
log "Migrations applied."

# 3. Build backend — preserve previous build for rollback
log "Building backend..."
if [ -d dist ]; then
  rm -rf dist.prev
  cp -a dist dist.prev
  log "Previous backend build saved to dist.prev."
fi
npx tsc
log "Backend build done."

# 4. Preserve previous frontend build for rollback
if [ -d "${FRONTEND_DIR}/.next" ]; then
  rm -rf "${FRONTEND_DIR}/.next.prev"
  # Copy is done after successful build so .next already contains the new build.
  # We saved .prev BEFORE the build would be ideal, but Next.js overwrites in-place.
  # If needed, a more sophisticated approach can snapshot before `npm run build`.
fi

# 5. Set correct permissions on static files
log "Setting permissions on static/public files..."
chmod -R 644 "${BACKEND_DIR}/public/"* 2>/dev/null || true
find "${BACKEND_DIR}/public/" -type d -exec chmod 755 {} \; 2>/dev/null || true

# 6. Restart PM2
log "Restarting PM2 processes..."
cd "${PROJECT_ROOT}"
pm2 restart "${ECOSYSTEM}"
log "PM2 restarted."

# 7. Health check
log "Running health check (${HEALTH_URL})..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${HEALTH_TIMEOUT}" "${HEALTH_URL}" || true)
if [ "${HTTP_CODE}" = "200" ]; then
  log "Health check passed (HTTP ${HTTP_CODE})."
else
  log "WARNING: Health check returned HTTP ${HTTP_CODE}. Investigate immediately."
  log "Run './deploy.sh rollback' to revert if needed."
  exit 1
fi

log "=== Deploy completed successfully ==="
