# VibeHosting Infrastructure Audit Report
**Date:** 2026-03-21 | **Auditor:** Infrastructure Team

---

## 1. PM2 & Process Management (ecosystem.config.js)

### Configuration
- **File:** `/root/vibecode/vibe-hosting/ecosystem.config.js`
- **Apps:** 2 processes (vibe-backend, vibe-frontend)
- **Home:** `/root/.pm2` (via PM2_HOME env var on prod)
- **Systemd:** pm2-root.service (enabled)

### Backend Process
| Setting | Value | Notes |
|---------|-------|-------|
| Name | `vibe-backend` | — |
| CWD | `/root/vibecode/vibe-hosting/backend` | Absolute path ✓ |
| Script | `dist/index.js` | Compiled TypeScript |
| Memory restart | 512MB | Reasonable for app size |
| Backoff restart | 100ms exponential | Good for flaky services |
| PORT | 7001 | Internal only (127.0.0.1) |
| HOST | **Not set** | ⚠️ Defaults to 0.0.0.0 (see ISSUES) |

### Frontend Process
| Setting | Value | Notes |
|---------|-------|-------|
| Name | `vibe-frontend` | — |
| CWD | `/root/vibecode/vibe-hosting/frontend` | Absolute path ✓ |
| Script | `next start -p 7002 -H 127.0.0.1` | Correct: localhost only |
| Memory restart | 512MB | Reasonable |
| PORT | 7002 | — |

### ✓ Strengths
- Both processes have explicit restart memory limits
- Exponential backoff prevents restart loops
- Frontend explicitly bound to localhost (127.0.0.1)
- CWD paths are absolute

### ⚠️ Issues
1. **Backend not localhost-bound:** No explicit `HOST=127.0.0.1` in env; defaults to 0.0.0.0. Nginx proxies correctly, but listening on all interfaces is unnecessarily exposed.

---

## 2. Deploy Script (scripts/deploy.sh)

### Process Overview
Frontend build → DB migrations → Backend TypeScript compile → PM2 restart → Health check

### ✓ Strengths
- **Rollback support:** Saves previous builds (.prev dirs) before overwrite
- **Graceful failure:** Health check catches deployment issues (HTTP 200 required)
- **Safe exit codes:** `set -euo pipefail` prevents silent failures
- **Timestamped logging:** Easy to track deployment timeline
- **Rollback command:** `./deploy.sh rollback` reverts to previous build

### ⚠️ Issues
1. **Frontend .next.prev:** Saved AFTER build completes; if build fails, .prev is stale
2. **Health check localhost-only:** Uses `http://localhost:7001/health` - fails if backend doesn't listen on 127.0.0.1
3. **No DB rollback:** If `npx prisma migrate deploy` fails, deploy stops but Prisma doesn't auto-rollback
4. **No atomic permissions:** Only chmod backend `public/`; other static assets may be missed
5. **Hardcoded ecosystem path:** Would fail if ecosystem.config.js is renamed

---

## 3. Package.json Dependencies

### Backend (v1.0.0) — 32 packages
**Security & Auth:** helmet ^8.1.0, cors ^2.8.5, jsonwebtoken ^9.0.2, bcrypt ^5.1.1, express-rate-limit ^7.5.0, rate-limit-redis ^4.2.0  
**Core:** express ^4.21.2, @prisma/client ^6.5.0, typescript ^5.7.0  
**File Storage:** multer ^1.4.5-lts.1, adm-zip ^0.5.16  
**Communication:** nodemailer ^8.0.1, node-telegram-bot-api ^0.67.0  
**Data:** redis ^5.11.0, bullmq ^5.34.0  
**Logging:** winston ^3.19.0

### Frontend (v1.0.0) — 7 packages
next ^16.1.6, react ^19.2.4, react-dom ^19.2.4, tailwindcss ^4.2.1, typescript 5.9.3, animejs ^4.3.6, qrcode.react ^4.2.0

### ✓ Strengths
- Modern, current versions
- Security standard (Helmet, bcrypt, rate-limiting)
- Async job queue (BullMQ) for background tasks
- Structured logging (Winston)

### ⚠️ Issues
1. No explicit npm audit in pipeline
2. TypeScript version pinned in frontend (5.9.3) but caret (^) in backend — inconsistent

---

## 4. Prisma Database Schema

### Models: 22 total
User, Project, Deployment, Domain, Subscription, ProjectLike, PageView, Report, EditorPage, PasswordReset, TelegramLink, FormSubmission, VisualPatch, EmailEvent, PaymentEvent

### Indexes: Strategic coverage
- **projects:** 5 indexes (user, slug, status, public+likes, public+created)
- **deployments:** 3 indexes (projectId, projectId+version, status)
- **page_views:** 3 indexes (project+created, path, date range)
- **email_events, visual_patches, password_resets:** Sufficient

### Migrations
- **Count:** 25 migrations (2026-02-27 → present)
- **Format:** Dated timestamps (YYYYMMDD)
- **Check constraints:** Added for data integrity
- **Cascading deletes:** Configured properly

### ✓ Strengths
- Comprehensive schema for hosting platform
- Proper foreign key relationships
- Event deduplication (EmailEvent, PaymentEvent)
- Soft constraints (expiry dates, status flags)

### ⚠️ Issues
1. No unique constraint on (projectId, version) for deployments
2. page_views / email_events may grow large (>1B rows) — consider partitioning long-term
3. Large JSON columns (EditorPage.gjsData, FormSubmission.data) lack schema validation
4. No soft-delete pattern; ProjectStatus.SUSPENDED prevents access but doesn't mark as deleted

---

## 5. Nginx Configuration (nginx-hostingvibe.ru)

### Routing Architecture
**Main site (hostingvibe.ru):** HTTP 80 → HTTPS redirect, HTTPS 443 proxies to backend (7001) & frontend (7002)  
**Wildcard subdomains (*.hostingvibe.ru):** Extracts slug, serves static from `/var/www/vibe-hosting/sites/$slug`, auth_request for password protection

### Security Headers
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- HSTS: max-age=31536000 (1 year)

### Caching
- **Static assets (.js, .css, fonts, etc.):** 1 year, immutable
- **HTML:** no-cache (always revalidate)

### ✓ Strengths
- Reserved slug list prevents admin/api/www takeover
- SSL/TLS with HTTP/2
- Gzip compression enabled (min 256B)
- 55MB upload limit matches backend config
- Password gate pattern (auth_request) for site protection
- Long caching for fingerprinted assets

### ⚠️ Issues
1. Canonical host map (`/etc/nginx/conf.d/vibe-canonical-hosts.map`) external — not in repo, manual maintenance required
2. Reserved slugs duplicated in Nginx AND backend config.ts
3. `more_clear_headers` requires nginx-http-more module (non-standard) — verify installed
4. No Nginx-level rate limiting (only backend)
5. WebSocket upgrade headers present but backend doesn't use WebSockets

---

## 6. Environment Variables

### Structure (backend/.env.example)
**Database:** DATABASE_URL, REDIS_URL  
**Storage:** UPLOAD_DIR, SITES_DIR, BACKUPS_DIR  
**Auth:** JWT_SECRET (required, 128-char hex)  
**CORS:** CORS_ORIGINS (JSON array, no wildcards)  
**Email:** SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL  
**Billing:** PRODAMUS_PAYFORM_URL, PRODAMUS_SECRET_KEY, PRODAMUS_SYSTEM_CODE, PRODAMUS_SUBSCRIPTION_ID  
**Telegram:** TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME  
**Optional:** LOG_DIR, LOG_LEVEL, NODE_ENV, SERVER_IP, BACKEND_URL, PRODAMUS_DEMO_MODE

### ✓ Strengths
- Comprehensive example provided
- Secrets never in code
- Sensible fallback defaults in config.ts
- Modular by service

### ⚠️ Issues
1. **HOST missing from .example** — Backend likely exposes 0.0.0.0 on prod without explicit env var
2. **No startup validation** — Missing DATABASE_URL crashes server at boot (not pre-flight)
3. **.env.backup in git** — File `/backend/.env.backup-20260309_161554` committed; could leak old secrets
4. **CORS_ORIGINS JSON fragile** — Silent fallback if parsing fails; syntax errors hidden
5. **PRODAMUS_DIAG flag** — Diagnostic logging doesn't sanitize payment data (could leak info)

---

## 7. Docker & Containerization

**Status:** Not containerized ✓ (bare metal PM2 deployment)

**Reasonable for:** Single server, monolithic app  
**Not suitable for:** Multi-region scaling, auto-scaling, zero-downtime deployments

No Dockerfile or docker-compose.yml present. Acceptable for current scale.

---

## 8. CI/CD Pipeline

**Status:** None found ✓

- No .github/workflows, .gitlab-ci.yml, or similar
- Manual deploy via `./deploy.sh`
- No automated testing or security scanning in deploy chain

### Implications
- Simple, full control
- No test gate (could deploy broken code)
- No staging environment
- No automated security scanning (npm audit)

---

## 9. Logging

### Backend (Winston)
**File:** `backend/src/services/logger.ts`  
**Transports:**
- Console: Colorized (dev)
- error.log: Errors only, 10MB rotation, 5 files max (50MB total)
- combined.log: All logs, 10MB rotation, 5 files max (50MB total)

**Format:** JSON with timestamp, level, service, metadata  
**Directory:** LOG_DIR env var (default: `./logs/`)

### ✓ Strengths
- Structured JSON easy to parse
- Log rotation prevents disk fill
- Error-only file for quick issue finding
- Stack traces included for errors

### ⚠️ Issues
1. **Log directory relative** — May resolve to unexpected location on prod; should use absolute path
2. **No external aggregation** — Local-only; logs lost if server crashes
3. **No request logging** — HTTP method, endpoint, status, duration not logged
4. **Sensitive data risk** — If debug level enabled, could log tokens/passwords
5. **Max files = 5** — Only 50MB history; depends on traffic volume

---

## 10. Security

### Helmet + Headers
- CSP: restrictive (defaultSrc: 'self', scriptSrc: 'unsafe-inline' ⚠️)
- HSTS: 31536000s (1 year) ✓
- Frame-Ancestors: 'none' ✓

### CORS
- Explicit whitelist (no wildcards) ✓
- Credentials allowed ✓
- Dynamic origin check ✓

### JWT
- Expiry: 7 days ✓
- Storage: httpOnly cookie `vibe_token` ✓
- Algorithm: HS256 (HMAC-SHA256) ✓

### Rate Limiting
- Login: 10/15min ✓
- Register: 5/15min ✓
- Deploy: 5/1h ✓
- Forgot password: 3/15min ✓
- API general: 100/1min ✓

### File Upload Safety
- Size: 55MB max ✓
- Forbidden extensions: .php, .exe, .sh, .py, .cgi, .htaccess, .bat, .cmd, .pl, .jsp, .asp, .aspx, .rb ✓
- ZIP bomb protection: Compression ratio ≤ 100:1 ✓
- File count: ≤ 5000 files/archive ✓

### ✓ Strengths
- Defense-in-depth (Helmet, rate-limit, bcrypt, validation)
- No hardcoded secrets
- Executable extensions blocked
- Secure cookie (httpOnly, no JS access)

### ⚠️ Issues
1. **CSP unsafe-inline:** scriptSrc allows inline; violates strict CSP
2. **No CSRF tokens:** No explicit CSRF protection visible
3. **No input validation:** Rate limiting behavioral only; no schema validation for bodies
4. **Zip bomb:** Ratio 100:1 with 55MB limit allows 5.5GB extraction (OS kills it, but inefficient)
5. **No audit logging:** Security events (login, deploy, domain changes) not logged
6. **Password reset token reuse:** No enforcement of one-time use after validation

---

## 11. TypeScript Configuration

### Backend
```
target: ES2022, module: commonjs, strict: true, sourceMap: true
outDir: dist, rootDir: src
```

### Frontend
```
target: ES2017, jsx: react-jsx, strict: true, moduleResolution: bundler
paths: @/* → ./src/*
```

### ✓ Strengths
- Strict mode in both ✓
- Source maps for debugging ✓
- Path aliases in frontend (@/imports) ✓

### ⚠️ Issues
1. **Different targets:** Backend ES2022, Frontend ES2017 — inconsistent; frontend should target ES2022
2. **Declaration disabled:** Backend has `"declaration": false` (unnecessary for non-library)
3. **skipLibCheck not set:** May slow large projects (currently not a bottleneck)

---

## 12. Health Checks

### Endpoint: /api/health
**Checks:**
1. Database: SELECT 1 via Prisma
2. Storage: fs.statSync on SITES_DIR
3. SMTP: verifySmtpConnection() (allowed to fail)

**Response:** 200 (ok) | 503 (degraded)

### Usage
- Deploy script calls after restart (fails if not 200)
- Manual monitoring via curl

### ✓ Strengths
- Simple, fast checks
- Graceful SMTP degradation
- Deploy gate (prevents bad deployments)

### ⚠️ Issues
1. No endpoint-specific checks (e.g., /api/projects works?)
2. Redis not checked (rate limiting could fail silently)
3. No performance metrics (latency, error rates, queue depth)
4. SMTP check expensive (5+ sec on network delay)

---

## Summary Risk Matrix

| Component | Status | Risk | Action |
|-----------|--------|------|--------|
| PM2 | 🟡 | Medium | Add HOST=127.0.0.1 to backend |
| Deploy | ✓ | Low | Good (health check, rollback) |
| Dependencies | ✓ | Low | Add npm audit to pipeline |
| Prisma/DB | ✓ | Low | 25 migrations, good schema |
| Nginx | 🟡 | Low | Verify nginx-http-more module |
| .env | 🟡 | Medium | HOST missing, .backup in git |
| Docker | ✓ | N/A | Not needed for single server |
| CI/CD | 🟡 | Medium | Add automated tests/scanning |
| Logging | 🟡 | Medium | Local-only, no aggregation |
| Security | ✓ | Low | CSP unsafe-inline, no CSRF visible |
| TypeScript | ✓ | Low | Targets inconsistent (minor) |
| Health | 🟡 | Low | Basic, SMTP slow |

---

## Top Priority Actions

### 🔴 Critical (Fix Immediately)
1. Add `HOST: '127.0.0.1'` to backend in ecosystem.config.js
2. Verify Nginx has nginx-http-more module installed (or replace more_clear_headers with alternatives)
3. Remove or overwrite .env.backup file in git history (prevents secret leakage)

### 🟡 High (Fix This Week)
4. Validate required env vars at startup (DATABASE_URL, JWT_SECRET, etc.)
5. Add npm test to deploy script before build
6. Log security events (login, deploy, domain changes)

### 🟠 Medium (Fix This Month)
7. Add request logging middleware (method, endpoint, status, duration)
8. Implement log aggregation (CloudWatch, ELK, or central Syslog)
9. Add npm audit to pre-commit hook or CI
10. Sync reserved slugs between Nginx and backend config

### 🟢 Nice-to-Have
11. Increase CSP strictness (move inline scripts to external)
12. Add database backup strategy with documentation
13. Monitor disk usage (SITES_DIR, BACKUPS_DIR, logs)
14. Consider database partitioning (page_views, email_events) if rows exceed 1B

---

**Report Generated:** 2026-03-21 | **Components Audited:** 12/12 ✓
