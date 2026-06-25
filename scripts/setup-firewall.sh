#!/usr/bin/env bash
# ============================================================
# UFW firewall setup for VibeHosting
# Run manually:  sudo bash setup-firewall.sh
# ============================================================
set -euo pipefail

echo "=========================================="
echo "  VibeHosting — UFW Firewall Setup"
echo "=========================================="
echo ""
echo "WARNING: This script will enable the UFW firewall."
echo "Only SSH (22), HTTP (80), and HTTPS (443) will be allowed."
echo "All other incoming traffic will be DENIED."
echo ""
echo "Make sure you have SSH access on port 22 before continuing."
echo ""
read -rp "Continue? [y/N] " confirm
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Resetting UFW to defaults..."
ufw --force reset

echo "Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

echo "Allowing SSH (port 22/tcp)..."
ufw allow 22/tcp comment 'SSH'

echo "Allowing HTTP (port 80/tcp)..."
ufw allow 80/tcp comment 'HTTP'

echo "Allowing HTTPS (port 443/tcp)..."
ufw allow 443/tcp comment 'HTTPS'

echo ""
echo "Enabling UFW..."
ufw --force enable

echo ""
echo "Current firewall status:"
ufw status verbose

echo ""
echo "Firewall setup complete."
echo "Backend listens on 127.0.0.1 — Nginx reverse-proxies to it."
