#!/usr/bin/env bash
# ============================================================
# SSL certificate check & auto-renew verification
# For VibeHosting (hostingvibe.ru)
# ============================================================
set -euo pipefail

DOMAIN="hostingvibe.ru"

echo "=========================================="
echo "  SSL Certificate Check — ${DOMAIN}"
echo "=========================================="
echo ""

# 1. Show certificate expiry
echo "--- Certificate expiry ---"
if command -v openssl &>/dev/null; then
  EXPIRY=$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null \
           | openssl x509 -noout -enddate 2>/dev/null || true)
  if [ -n "${EXPIRY}" ]; then
    echo "  ${EXPIRY}"
  else
    echo "  Could not retrieve certificate from ${DOMAIN}:443"
  fi
else
  echo "  openssl not installed — skipping remote check."
fi
echo ""

# 2. Show certbot-managed certificates
echo "--- Certbot certificates ---"
if command -v certbot &>/dev/null; then
  certbot certificates 2>/dev/null || echo "  (no certificates found or certbot error)"
else
  echo "  certbot is not installed."
fi
echo ""

# 3. Check systemd timer for auto-renewal
echo "--- Certbot renewal timer ---"
if systemctl is-active --quiet certbot.timer 2>/dev/null; then
  echo "  certbot.timer is ACTIVE."
  systemctl list-timers certbot.timer --no-pager 2>/dev/null || true
elif systemctl is-active --quiet snap.certbot.renew.timer 2>/dev/null; then
  echo "  snap.certbot.renew.timer is ACTIVE."
  systemctl list-timers snap.certbot.renew.timer --no-pager 2>/dev/null || true
else
  echo "  WARNING: No active certbot renewal timer found."
  echo ""
  echo "  To set up auto-renewal:"
  echo "    sudo systemctl enable --now certbot.timer"
  echo "  Or add a crontab entry:"
  echo "    0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"
fi
echo ""

# 4. Dry-run renewal test
echo "--- Dry-run renewal ---"
if command -v certbot &>/dev/null; then
  echo "  Running: certbot renew --dry-run"
  certbot renew --dry-run 2>&1 || echo "  WARNING: dry-run renewal failed — investigate."
else
  echo "  certbot not installed — cannot run dry-run."
fi
echo ""
echo "Check complete."
