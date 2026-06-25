# Аудит инфраструктуры VibeHosting — Краткое резюме

**Дата**: 2026-03-21
**Статус**: ✅ ХОРОШО (production-ready с улучшениями)

---

## 1️⃣ Что работает хорошо

### PM2 (ecosystem.config.js)
- ✅ Memory limit 512M на оба процесса
- ✅ Exponential backoff (100ms) против crash loop
- ✅ Правильные пути (/root/vibecode/vibe-hosting/...)
- ✅ Frontend привязан к 127.0.0.1:7002 (не публичный)

### Безопасность
- ✅ Helmet CSP с явными directives
- ✅ CORS: явный whitelist (no wildcards)
- ✅ Rate limiting на Redis (7 разных лимитеров)
- ✅ Auth: JWT 7 дней, token invalidation через tokenVersion
- ✅ CSRF protection на POST/PUT/DELETE через Origin checks

### База данных
- ✅ PostgreSQL с 19 миграциями
- ✅ Правильные индексы на popular queries
- ✅ Cascading deletes для целостности данных
- ✅ Proper enum types для status fields

### Логирование
- ✅ Winston logger с file rotation (10MB, 5 файлов)
- ✅ Structured JSON format
- ✅ Error logs + combined logs
- ✅ Request ID middleware (requestIdMiddleware)

---

## 2️⃣ Критические проблемы (сейчас же)

### 🔴 1. .env.backup в git
**Файл**: `backend/.env.backup-20260309_161554`

Это security risk! Может содержать:
- JWT_SECRET
- DATABASE_URL
- SMTP credentials
- API tokens (Telegram, Prodamus)

**Решение**:
```bash
git rm backend/.env.backup*
echo ".env" >> .gitignore
echo ".env.backup*" >> .gitignore
git commit -m "Remove .env backups from git"
```

### 🔴 2. Отсутствует pre-deploy валидация
**Файл**: `scripts/deploy.sh`

Что может пойти не так:
- backend/.env не существует → crash при старте
- database migration fails → rollback не сработает
- package-lock.json поменялся → npm ci не выполнен

**Решение** (в deploy.sh, в начало):
```bash
# Check backend/.env
if [ ! -f backend/.env ]; then
  log "ERROR: backend/.env not found"
  exit 1
fi

# Verify migrations will apply
cd backend
npx prisma migrate deploy --dry-run || {
  log "ERROR: Migration dry-run failed"
  exit 1
}
cd ..
```

### 🔴 3. Отсутствует deploy lock
Если два разработчика запустят deploy одновременно:
- Race condition на .next, dist, .next.prev
- Может вырезать live версию сайта

**Решение**:
```bash
LOCK_FILE="/tmp/vibe-hosting.deploy.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Deploy already in progress. Waiting..."
  flock 9
fi
```

---

## 3️⃣ Высокий приоритет (1-2 недели)

### 🟡 Нет CI/CD pipeline
**Status**: ❌ Не реализовано

Нужно:
```bash
# .github/workflows/test.yml
# .github/workflows/security.yml (npm audit)
# .github/workflows/deploy.yml (auto-deploy main → prod)
```

**Выгода**: Автоматические тесты, проверка безопасности перед деплоем, автоматизация

### 🟡 Нет Docker/containerization
**Status**: ❌ Не реализовано

**Выгода**: Dev/prod parity, быстрый rollback, scaling

### 🟡 Workers в одном процессе с HTTP
**Файлы**:
- `backend/src/services/cleanup.ts`
- `backend/src/services/engagement-worker.ts`

**Проблема**: Если worker зависнет → весь сервис вниз

**Решение**: Отдельный PM2 процесс:
```javascript
// ecosystem.config.js
{
  name: 'vibe-worker',
  cwd: '/root/vibecode/vibe-hosting/backend',
  script: 'dist/worker.ts',
  instances: 2,
  exec_mode: 'cluster',
}
```

### 🟡 Health check неполный
**Файл**: `backend/src/routes/health.ts`

Проверяет:
- ✅ Database (SELECT 1)
- ✅ Storage directory
- ✅ SMTP configuration
- ❌ Redis (critical for rate limiting!)
- ❌ Telegram connectivity
- ❌ Prodamus API

**Решение**: Добавить Redis check:
```typescript
try {
  await redis.ping();
  checks.redis = 'ok';
} catch {
  checks.redis = 'error';
}
```

### 🟡 unsafe-inline в CSP
**Файл**: `backend/src/app/security.ts`

```javascript
scriptSrc: ["'self'", "'unsafe-inline'"],  // ⚠️ XSS risk
styleSrc: ["'self'", "'unsafe-inline'"],   // ⚠️
```

**Решение**: Использовать nonce:
```javascript
scriptSrc: ["'self'", `'nonce-${randomNonce}'`],
```

---

## 4️⃣ Средний приоритет (2-4 недели)

### 🟢 Отсутствует structured request logging
**Сейчас**: Только error.log + combined.log (file-based)

**Нужно**:
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.userId,
      ip: req.ip,
    });
  });
  next();
});
```

### 🟢 Нет external monitoring
**Нужно**:
- APM (Datadog, NewRelic, Sentry)
- Log aggregation (ELK, Datadog, Splunk)
- Uptime monitoring (Pingdom, StatusPage)

### 🟢 Rate limiting по IP, а не по пользователю
**Проблема**: За NAT/proxy несколько пользователей = одна IP

**Решение**: Per-user limiting (требует auth для всех endpoints)

### 🟢 Nginx конфиг не в repo
Нужно добавить reference config:
```bash
# nginx/hostingvibe.ru.conf
```

---

## Таблица приоритетов

| # | Задача | Приоритет | Время | Риск |
|---|--------|-----------|-------|------|
| 1 | Убрать .env.backup из git | 🔴 Critical | 10 мин | SECURITY |
| 2 | Добавить pre-deploy checks | 🔴 Critical | 1 час | STABILITY |
| 3 | Implement deploy lock | 🔴 Critical | 30 мин | STABILITY |
| 4 | CI/CD pipeline (GitHub Actions) | 🟡 High | 3-4 часа | PROCESS |
| 5 | Docker Dockerfile | 🟡 High | 2-3 часа | SCALING |
| 6 | Отделить workers в отдельный процесс | 🟡 High | 1-2 часа | RELIABILITY |
| 7 | Redis health check | 🟡 High | 30 мин | VISIBILITY |
| 8 | Migrate CSP от unsafe-inline | 🟡 High | 2-3 часа | SECURITY |
| 9 | External monitoring (APM) | 🟢 Medium | 2-3 часа | VISIBILITY |
| 10 | Structured request logging | 🟢 Medium | 1 час | VISIBILITY |

---

## Checklist для быстрого фикса

```bash
# День 1 (Critical)
- [ ] git rm backend/.env.backup* && add to .gitignore
- [ ] Add pre-deploy checks (backend/.env, prisma dry-run)
- [ ] Add deploy lock mechanism (flock)
- [ ] Test deploy script manually

# День 2-3 (High)
- [ ] Create .github/workflows/test.yml
- [ ] Create .github/workflows/security.yml (npm audit)
- [ ] Add Redis check to health endpoint
- [ ] Separate worker process in ecosystem.config.js
- [ ] Test worker separation

# День 4-5 (High)
- [ ] Create Dockerfile for backend
- [ ] Create Dockerfile for frontend
- [ ] Create docker-compose.yml for local dev
- [ ] Migrate unsafe-inline CSP to nonce-based

# День 6+ (Medium)
- [ ] Set up log aggregation (Datadog/ELK)
- [ ] Add request logging middleware
- [ ] Create reference nginx.conf
```

---

## Документация

**Полный отчёт**: `/root/vibecode/vibe-hosting/INFRASTRUCTURE_AUDIT.md`

Содержит детальный анализ всех 12 пунктов:
1. PM2 (ecosystem.config.js)
2. Deploy script (scripts/deploy.sh)
3. Dependencies (package.json)
4. Prisma configuration
5. TypeScript configs
6. Security (Helmet, CORS, Auth, Rate Limiting)
7. Logging (Winston)
8. Environment variables
9. Docker (missing)
10. CI/CD (missing)
11. Health checks & Monitoring
12. Background workers (BullMQ)

---

**Вопросы?** Смотри INFRASTRUCTURE_AUDIT.md на соответствующие секции.
