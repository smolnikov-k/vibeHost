#!/usr/bin/env bash
# ============================================================
# VibeHosting service monitor
# Checks: backend, frontend, nginx, PostgreSQL, Redis, disk
# Sends alerts via Telegram Bot API (through OpenClaw bot)
# Cron: */2 * * * * /root/vibecode/vibe-hosting/scripts/monitor.sh
# ============================================================
set -euo pipefail

TELEGRAM_BOT_TOKEN="${VIBE_TELEGRAM_BOT_TOKEN:?set VIBE_TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${VIBE_TELEGRAM_CHAT_ID:?set VIBE_TELEGRAM_CHAT_ID}"
HEALTH_BACKEND="http://127.0.0.1:7001/api/gallery"
HEALTH_FRONTEND="http://127.0.0.1:7002"
HEALTH_SITE="https://hostingvibe.ru"
DISK_THRESHOLD=85
STATE_FILE="/tmp/vibe-monitor-state"

send_telegram() {
  local msg="$1"
  curl -sf --max-time 10 \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=${msg}" \
    -d "parse_mode=HTML" >/dev/null 2>&1 || \
  echo "[monitor] Failed to send Telegram alert"
}

alert() {
  local msg="$1"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  send_telegram "⚠️ <b>VibeHosting Alert</b> [$ts]

$msg"
  echo "[$(date '+%H:%M:%S')] ALERT: $msg"
}

recover() {
  local msg="$1"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  send_telegram "✅ <b>VibeHosting Recovered</b> [$ts]

$msg"
  echo "[$(date '+%H:%M:%S')] RECOVERED: $msg"
}

check_service() {
  local name="$1"
  local check_cmd="$2"
  local key="fail_${name}"

  if eval "$check_cmd" >/dev/null 2>&1; then
    if grep -q "$key" "$STATE_FILE" 2>/dev/null; then
      sed -i "/$key/d" "$STATE_FILE"
      recover "$name is back online"
    fi
    return 0
  else
    if ! grep -q "$key" "$STATE_FILE" 2>/dev/null; then
      echo "$key" >> "$STATE_FILE"
      alert "$name is DOWN!"
    fi
    return 1
  fi
}

# Initialize state file
touch "$STATE_FILE"

errors=""

# 1. Backend (HTTP check)
check_service "backend" "curl -sf --max-time 5 $HEALTH_BACKEND" || errors="${errors}backend "

# 2. Frontend (HTTP check)
check_service "frontend" "curl -sf --max-time 5 $HEALTH_FRONTEND" || errors="${errors}frontend "

# 3. Site via nginx (external)
check_service "nginx-site" "curl -sf --max-time 10 $HEALTH_SITE" || errors="${errors}nginx "

# 4. PostgreSQL
check_service "postgresql" "pg_isready -h 127.0.0.1 -p 5432 -q" || errors="${errors}postgres "

# 5. Redis
check_service "redis" "redis-cli ping" || errors="${errors}redis "

# 6. PM2 processes
check_service "pm2-backend" "sudo PM2_HOME=/opt/vibe-hosting/.pm2 pm2 show vibe-backend 2>/dev/null | grep -q online" || errors="${errors}pm2-backend "
check_service "pm2-frontend" "sudo PM2_HOME=/opt/vibe-hosting/.pm2 pm2 show vibe-frontend 2>/dev/null | grep -q online" || errors="${errors}pm2-frontend "

# 7. Disk usage
disk_pct=$(df / --output=pcent | tail -1 | tr -d '% ')
disk_key="fail_disk"
if [ "$disk_pct" -ge "$DISK_THRESHOLD" ]; then
  if ! grep -q "$disk_key" "$STATE_FILE" 2>/dev/null; then
    echo "$disk_key" >> "$STATE_FILE"
    alert "Disk usage at ${disk_pct}% (threshold: ${DISK_THRESHOLD}%)"
  fi
elif grep -q "$disk_key" "$STATE_FILE" 2>/dev/null; then
  sed -i "/$disk_key/d" "$STATE_FILE"
  recover "Disk usage back to ${disk_pct}%"
fi

# 8. RAM check (alert if swap > 50%)
swap_total=$(free | awk '/Swap/ {print $2}')
swap_used=$(free | awk '/Swap/ {print $3}')
if [ "$swap_total" -gt 0 ]; then
  swap_pct=$((swap_used * 100 / swap_total))
  swap_key="fail_swap"
  if [ "$swap_pct" -ge 50 ]; then
    if ! grep -q "$swap_key" "$STATE_FILE" 2>/dev/null; then
      echo "$swap_key" >> "$STATE_FILE"
      alert "Swap usage at ${swap_pct}% — possible memory leak"
    fi
  elif grep -q "$swap_key" "$STATE_FILE" 2>/dev/null; then
    sed -i "/$swap_key/d" "$STATE_FILE"
    recover "Swap usage back to ${swap_pct}%"
  fi
fi

if [ -z "$errors" ]; then
  echo "[$(date '+%H:%M:%S')] All services OK"
fi
