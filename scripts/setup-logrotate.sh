#!/usr/bin/env bash
# ============================================================
# PM2 log rotation setup for VibeHosting
# Installs pm2-logrotate and configures retention.
# ============================================================
set -euo pipefail

echo "Installing pm2-logrotate module..."
pm2 install pm2-logrotate

echo "Configuring pm2-logrotate..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true

echo ""
echo "pm2-logrotate configured:"
echo "  max_size  = 50M   (rotate when log exceeds 50 MB)"
echo "  retain    = 14    (keep 14 rotated files)"
echo "  compress  = true  (gzip rotated logs)"
echo ""
echo "Done."
