# VibeHosting — Паттерны и соглашения

## Код

- TypeScript strict, ESM
- Emerald (green-500/600) — акцентный цвет UI
- anime.js 4.x: именованные экспорты (`import { animate } from 'animejs'`), delay param type `unknown`
- React 19: `useRef<T>(null)` требует initial value
- `'use client'` для интерактивных компонентов

## API ответы

Успех — прямой объект или обёрнутый:
```typescript
// Прямой: { id, slug, title, ... }
// Обёрнутый: { projects: [...], pagination: { page, limit, total, totalPages } }
// Клиент: response.project || response (fallback)
```

Ошибка:
```typescript
{ error: "Текст на русском", code?: "PROJECT_LIMIT" }
// Клиент ApiError(status, message) → auto-redirect на /login при 401
```

## Аутентификация

- JWT HS256, 30 дней, Bearer token
- localStorage: `vibe_token`, cookie: `vibe_token` (для Next.js middleware)
- 3 уровня: `optionalAuth` → `authMiddleware` → `adminMiddleware`
- Password gate для сайтов: cookie `vibe_access_{slug}` = HMAC(SHA256, passwordHash, slug), TTL 7 дней

## Deploy pipeline

1. ZIP upload → validateZip (бомбы ratio 100x, forbidden ext, max 5000 файлов)
2. Extract в /tmp/vibe-extract-{id}/
3. Если package.json + build script → `npm ci && npm run build`
4. Atomic swap: rename → `/var/www/vibe-hosting/sites/{slug}/`
5. Auto-inject `vibe-forms.js` + `vibe-patches.js` во все HTML (перед `</body>`)
6. setNginxPermissions (spawnSync, без shell injection)
7. PRO: backup старой версии в /backups/{slug}/v{N}

## Visual Patches

4 типа: `text`, `image`, `hide`, `style`
Style whitelist: color, fontSize, fontWeight, backgroundColor, padding, margin, border, borderRadius, display, opacity, width, height, maxWidth, textAlign, lineHeight, letterSpacing

## Cleanup worker (каждые 15 мин)

- Expired subscriptions → PAST_DUE, user.plan → FREE
- Expired FREE sites (expiresAt < now) → файлы удаляются, status → SUSPENDED

## SPA-детекция

Проверяет body HTML на `<div id="(root|app|__next)">` → `isSPA: boolean`

## BigInt

Prisma возвращает `BigInt` для sizeBytes — приводить к `Number()` перед JSON-ответом.

## Custom type declarations

`backend/src/types/global.d.ts` содержит кастомные декларации (exec, promisify, resolve4, symlinkSync, copyFileSync). При использовании нового Node.js API — добавить декларацию сюда.

## Rate limiting

| Limiter | Лимит | Где |
|---------|-------|-----|
| authLimiter | 10 req / 15 мин | /auth/* |
| deployLimiter | 5 req / 1 час | deploy, deploy-github |
| apiLimiter | 100 req / 1 мин | всё остальное |
