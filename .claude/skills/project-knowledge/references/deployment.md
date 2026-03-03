# VibeHosting — Деплой и инфраструктура

## Серверы

| | Production | Dev |
|-|-----------|-----|
| IP | 213.159.209.228 | 213.139.229.139 |
| SSH | `sshpass -p 'Vibecoder' ssh -o StrictHostKeyChecking=no root@213.159.209.228` | Требует пароль |
| Роль | Основной (hostingvibe.ru) | Разработка |
| PM2 | `sudo PM2_HOME=/root/.pm2 pm2` | `sudo PM2_HOME=/root/.pm2 pm2` |

## Deploy workflow (dev → production)

```bash
# 1. Редактируем код на dev-сервере
# 2. Собираем backend
cd /root/vibecode/vibe-hosting/backend && npx tsc

# 3. Собираем frontend
cd /root/vibecode/vibe-hosting/frontend && npx next build

# 4. Синхронизируем на production
sshpass -p 'Vibecoder' rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" \
  /root/vibecode/vibe-hosting/frontend/.next/ \
  root@213.159.209.228:/root/vibecode/vibe-hosting/frontend/.next/

sshpass -p 'Vibecoder' rsync -az -e "ssh -o StrictHostKeyChecking=no" \
  /root/vibecode/vibe-hosting/backend/src/ \
  root@213.159.209.228:/root/vibecode/vibe-hosting/backend/src/

# 5. Собираем backend на production
sshpass -p 'Vibecoder' ssh root@213.159.209.228 \
  "cd /root/vibecode/vibe-hosting/backend && npx tsc"

# 6. Перезапуск PM2
sshpass -p 'Vibecoder' ssh root@213.159.209.228 \
  "sudo PM2_HOME=/root/.pm2 pm2 restart vibe-backend vibe-frontend && sudo PM2_HOME=/root/.pm2 pm2 save"

# 7. Фикс пермишенов статики (Nginx www-data)
sshpass -p 'Vibecoder' ssh root@213.159.209.228 \
  "chmod -R o+rX /root/vibecode/vibe-hosting/frontend/.next/static/"

# 8. Проверка
curl -s -o /dev/null -w "%{http_code}" https://hostingvibe.ru
```

## Nginx (production)

Конфиг: `/etc/nginx/sites-available/vibehosting`

- `hostingvibe.ru` → proxy 7002 (frontend), `/api` → proxy 7001 (backend)
- `/_next/static/` → alias на диск (минуя Node.js)
- `*.hostingvibe.ru` → static `/var/www/vibe-hosting/sites/{slug}/`
  - `auth_request /___auth` → password gate через backend
  - CORS: `Access-Control-Allow-Origin: https://hostingvibe.ru` (для editor)
  - `X-Frame-Options` убран (для iframe preview в редакторе)

## Кастомные домены — провижининг

Файл: `backend/src/services/domain-provision.ts`

1. DNS verify → проверяет A-запись на 213.159.209.228
2. Генерация HTTP-only Nginx конфига (для certbot ACME challenge)
3. `certbot --nginx -d domain -d www.domain`
4. Генерация полного HTTPS конфига (с auth_request, CORS, www→redirect)
5. `nginx -t && systemctl reload nginx`
6. Обновление БД: sslStatus → ACTIVE

## Файловая структура на production

```
/var/www/vibe-hosting/
  sites/{slug}/        — файлы опубликованных сайтов
  uploads/             — временные загрузки
  backups/{slug}/v{N}/ — backup версий (PRO)
/var/www/certbot/      — ACME challenge root
```

## Пермишены

Nginx работает под `www-data`. Путь `/root/` имеет `chmod 711` для traversal.
После каждого билда frontend нужно: `chmod -R o+rX .next/static/`

## PM2 конфиг (ecosystem.config.js)

```javascript
// vibe-backend: node dist/index.js, port 7001, cwd: backend/
// vibe-frontend: npx next start -p 7002, cwd: frontend/
// env: JWT_SECRET, DATABASE_URL, NEXT_PUBLIC_API_URL и др.
```

## Проверка после деплоя

```bash
curl -s -o /dev/null -w "%{http_code}" https://hostingvibe.ru        # 200
curl -s -o /dev/null -w "%{http_code}" https://hostingvibe.ru/api/health  # 200
```
