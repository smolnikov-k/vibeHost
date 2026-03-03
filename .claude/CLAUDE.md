# VibeHosting — hostingvibe.ru

## Stack
- **Backend:** Express.js + TypeScript, port 7001, PM2 `vibe-backend`
- **Frontend:** Next.js 16 + Tailwind v4 + anime.js 4.x, port 7002, PM2 `vibe-frontend`
- **DB:** PostgreSQL 16 + Prisma ORM
- **Storage:** `/var/www/vibe-hosting/{sites,uploads,backups,previews}`

## Directive
Pure hosting first, AI features later. Users upload ZIP/HTML → instant hosting on `slug.hostingvibe.ru`.

## Structure
```
backend/
  src/routes/      — auth, projects, deploy, domains, gallery, billing, slugs
  src/services/    — deploy.service, github.service
  src/middleware/   — auth, upload, rateLimit
  src/utils/       — zip, slug, limits
  prisma/schema.prisma
frontend/
  src/app/         — Next.js App Router pages
  src/lib/api.ts   — API client with JWT
  src/lib/auth.tsx  — AuthProvider + useAuth
  src/components/   — landing components
```

## Conventions
- API responses: may return data directly or wrapped — use `response.project || response`
- JWT: 30-day, Bearer token, localStorage `vibe_token`
- Tariffs: FREE (1 site, 50MB), PRO (3 sites, 500MB, 386₽/mo)
- Emerald accent color (green-500/600)
- anime.js 4.x: named exports, delay param type is `unknown`
- React 19: `useRef<T>(null)` requires initial value

## Deploy
```bash
cd /root/vibecode/vibe-hosting/backend && npx tsc --noEmit
cd /root/vibecode/vibe-hosting/frontend && npm run build
sudo PM2_HOME=/root/.pm2 pm2 restart vibe-backend vibe-frontend
```

## TODO
See `/root/vibecode/vibe-hosting/TODO.md`
