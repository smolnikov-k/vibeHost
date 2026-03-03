#!/bin/bash
echo "CERTBOT_VALIDATION=${CERTBOT_VALIDATION}" > /tmp/certbot-dns-challenge.txt
echo ""
echo "============================================"
echo "  TXT-запись для DNS:"
echo "  Хост: _acme-challenge"
echo "  Значение: ${CERTBOT_VALIDATION}"
echo "============================================"
# Wait for user to add DNS record
while [ ! -f /tmp/certbot-dns-continue ]; do
    sleep 2
done
rm -f /tmp/certbot-dns-continue
