#!/bin/bash
# Manual DNS-01 hook for certbot
# This script pauses and waits for the user to add the TXT record
echo ""
echo "============================================"
echo "  Добавьте TXT-запись в DNS (Timeweb):"
echo "============================================"
echo ""
echo "  Имя:      _acme-challenge.hostingvibe.ru"
echo "  Тип:      TXT"
echo "  Значение:  ${CERTBOT_VALIDATION}"
echo ""
echo "============================================"
echo ""
echo "После добавления подождите 1-2 минуты и нажмите Enter..."
read -r
