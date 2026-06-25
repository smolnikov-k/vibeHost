# VibeHosting Backend — Comprehensive Audit Report
**Date:** 2026-03-21
**Path:** `/root/vibecode/vibe-hosting/backend/`

---

## 1. Entry Point & App Setup

### Index Entry (`src/index.ts`)
- **Port:** 7001 (configurable via `PORT` env var)
- **Host:** 127.0.0.1 (configurable via `HOST` env var)
- **Boot Sequence:**
  1. Loads dotenv config
  2. Creates Express app via `createApp()`
  3. Starts HTTP server on port/host
  4. Spawns background workers:
     - `runCleanupWorker()` — cleans old deployments
     - `runEngagementWorker()` — monitors user engagement
     - `initTelegramBot()` — initializes Telegram bot
  5. Handles SIGTERM/SIGINT gracefully (closes server, disconnects Prisma/Redis)

### Config (`src/config.ts`)
**Core Settings:**
- JWT: 7-day expiry, HS256 algorithm
- Database: Prisma ORM (required `DATABASE_URL`)
- Redis: rate-limit store (`redis://localhost:6379/4` by default)
- File storage: `/var/www/vibe-hosting/{uploads,sites,backups}`

**Plan Limits:**
- **FREE:** 1 project, 50 MB site size, 50 MB total storage, 3 versions
- **PRO:** 3 projects, 500 MB site size, 1 GB total storage, 15 versions

**Security Blacklist:**
- Forbidden extensions: `.php .exe .sh .py .cgi .htaccess .bat .cmd .pl .jsp .asp .aspx .rb`
- Ignored files: `.env .git .gitignore .npmrc .DS_Store Thumbs.db` etc.
- Reserved slugs: `www api admin app mail ftp static cdn billing login register` etc.

**External Services:**
- Prodamus (payment provider): `PRODAMUS_PAYFORM_URL`, `PRODAMUS_SECRET_KEY`, `PRODAMUS_SYSTEM_CODE`, `PRODAMUS_SUBSCRIPTION_ID`
- SMTP (Yandex by default): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Telegram bot: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- Server IP: `SERVER_IP` (203.0.113.10)
- CORS origins: explicit allowlist (default: hostingvibe.ru + www)

### App Factory (`src/app/create-app.ts`)
**Middleware Chain (in order):**
1. `trust proxy 1` — trusts single Nginx reverse proxy
2. `requestIdMiddleware` — attaches unique request ID for logging
3. **INTERNAL PREVIEW route** (`/api`) — mounted BEFORE Helmet (allows iframe no-CSP)
4. `apiLimiter` — 100 req/min global rate limit
5. **Helmet security** — (CSP, HSTS, etc.) — *skipped for public cross-origin routes*
6. **CORS** — origin allowlist validation
7. **Webhook diagnostics** (optional `PRODAMUS_DIAG=1`)
8. **Webhook body preservation** — raw body saved for HMAC verification
9. `cookieParser()` — parses httpOnly cookies
10. Global `express.json()` (100 KB limit)
11. Public routes (health, auth, forms, etc.)
12. Protected routes (projects, billing, domains, etc.)
13. Catch-all `/api/*` → 404
14. Global error handler

**Special Notes:**
- Webhook route (`/api/billing/webhook`) has custom parsers (JSON + urlencoded) with `verify` hook to capture raw body
- Diagnostic middleware logs webhook metadata (signature length, body hash) when `PRODAMUS_DIAG=1`

---

## 2. Security Architecture

### Helmet + CSP Configuration (`src/app/security.ts`)

**CSP Directives:**
```
default-src: 'self'
script-src: 'self' 'unsafe-inline'
style-src: 'self' 'unsafe-inline'
img-src: 'self' data: https:
connect-src: 'self' https://api.hostingvibe.ru wss:
font-src: 'self' https://fonts.gstatic.com
frame-ancestors: 'self' https://hostingvibe.ru
```

**HSTS:** 31536000 seconds (1 year), includeSubDomains=true

**Helmet Bypass Rules:**
- Routes starting with `/api/vibe-` (scripts for user sites) → NO Helmet
- Routes starting with `/api/patches/`, `/api/track`, `/api/pixel` → NO Helmet
- These routes get `Access-Control-Allow-Origin: *` instead

**CORS:**
- Explicit origin allowlist (no wildcards)
- Credentials: true (allows cookies in cross-origin requests)
- Fallback origins in dev: `http://localhost:3000`, `http://localhost:7002`

### Authentication (`src/middleware/auth.ts`)

**JWT Payload:**
```typescript
{
  userId: string,
  email: string,
  tokenVersion?: number  // token revocation check
}
```

**Token Sources (priority order):**
1. `Authorization: Bearer <token>` header
2. `vibe_token` httpOnly cookie (7-day expiry, `sameSite: strict`)
3. Legacy: `?token=<token>` query param (deprecated, logs warning)

**Auth Modes:**

| Middleware | Behavior | Where |
|-----------|----------|-------|
| `optionalAuth` | Sets `userId` if valid token, continues as anonymous if not | `/api/auth` routes |
| `authMiddleware` | Requires valid token, returns 401 if missing/invalid | Protected `/api/projects/*`, `/api/billing`, `/api/domains` |
| `adminMiddleware` | Requires `isAdmin=true` in User, returns 403 if not | `/api/admin/*` |

**Token Revocation:**
- On password change/reset: `user.tokenVersion++` is incremented
- JWT payload includes `tokenVersion`
- Auth middleware checks `db.user.tokenVersion` matches payload version
- If mismatch: token is treated as revoked, returns 401

**CSRF Protection (Cookie Auth):**
- Mutating methods (POST/PUT/PATCH/DELETE) with cookie auth require `Origin` header validation
- Origin must be in `TRUSTED_ORIGINS` set (built from `config.corsOrigins` + `config.frontendUrl`)
- Returns 403 if origin is missing or untrusted

### Rate Limiting (`src/middleware/rateLimit.ts`)

**Per-endpoint limiters (Redis-backed, fallback to in-memory):**

| Limiter | Window | Max | Endpoint |
|---------|--------|-----|----------|
| `loginLimiter` | 15 min | 10 | `POST /api/auth/login` |
| `registerLimiter` | 15 min | 5 | `POST /api/auth/register` |
| `siteGateLimiter` | 15 min | 10 | `POST /api/site-gate/:slug` |
| `deployLimiter` | 1 hour | 5 | `POST /api/projects/:id/deploy` |
| `apiLimiter` | 1 min | 100 | Global (mounted early in chain) |
| `forgotPasswordLimiter` | 15 min | 3 | `POST /api/auth/forgot-password` |
| `resetPasswordLimiter` | 15 min | 5 | `POST /api/auth/reset-password` |
| `formSubmissionLimiter` | 1 min | 10 | `POST /api/forms/:slug` |
| `likeLimiter` | 1 min | 20 | `POST /api/gallery/:id/like` |

**Redis Fallback:**
- If Redis unavailable: switches to in-memory store
- Logs warning on connect failure, uses in-memory as graceful degradation

---

## 3. All Routes (19 Files)

### Public Routes (No Auth Required)

#### `auth.ts` — User Authentication
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/auth/register` | Create account (per-endpoint `registerLimiter`) |
| POST | `/api/auth/login` | Login (per-endpoint `loginLimiter`) |
| GET | `/api/auth/me` | Get current user (requires optional auth, public if no token) |
| POST | `/api/auth/forgot-password` | Request password reset link |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/change-password` | Change password (requires auth) |
| PUT | `/api/auth/profile` | Update displayName, phone (requires auth) |
| POST | `/api/auth/logout` | Clear auth cookie |
| DELETE | `/api/auth/account` | Delete account (requires password confirmation, 152-ФЗ compliant) |

**Security:**
- Password: bcrypt hash (cost 10), min 8 chars, must include letter + digit
- Display name: DOMPurify sanitized (no tags), max 50 chars
- Email: basic regex validation
- Phone: digits only, 10-15 chars
- Token revocation on password change via `tokenVersion++`

#### `health.ts` — Service Health Check
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/health` | Returns status of database, storage, SMTP |

#### `slug-check.ts` — Project Slug Availability
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/slugs/check?slug=<slug>` | Check if slug is available + reserved |

#### `pixel.ts` & `analytics.ts` — Analytics Tracking
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/vibe-analytics.js` | Lightweight JS pixel (embeds in user sites) |
| POST | `/api/track` | Track page view (called by pixel) |
| GET | `/api/projects/:id/analytics` | Get project analytics (requires auth) |

**Analytics Logic:**
- IP anonymization: zero last octet (IPv4) or last 80 bits (IPv6)
- IP dedup: 1 hour cooldown per IP per project
- Stores: path, user-agent, referrer, ip hash
- Project view counter increment

#### `public-assets.ts` — Cross-Origin Scripts
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/vibe-forms.js` | Forms handling library (CORS: `*`) |
| GET | `/api/vibe-editor-bridge.js` | Editor iframe bridge (CORS: `*`) |
| GET | `/api/vibe-patches.js` | Style patches runtime (CORS: `*`) |
| GET | `/api/vibe-analytics.js` | Analytics pixel (CORS: `*`) |

**CORS Override:**
- These scripts remove Helmet headers via `res.removeHeader()`
- Set `Access-Control-Allow-Origin: *` to allow user sites to load them

#### `forms.ts` — Form Submissions
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/forms/:slug` | Submit form → Telegram webhook |
| OPTIONS | `/api/forms/:slug` | CORS preflight |

**Features:**
- Custom CORS: allows only `*.hostingvibe.ru` + verified custom domains
- Dedup: 30-second window per IP (in-memory map, auto-cleanup)
- Max 20 fields, max 2048 chars per field
- IP hashing for privacy
- Sends to Telegram via bot API (form name, fields, IP, user-agent)

#### `gallery.ts` — Public Gallery
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/gallery` | List published projects |
| GET | `/api/gallery/:id` | Get project details |
| POST | `/api/gallery/:id/like` | Like project (limiter: 20/min) |

#### `report.ts` — Abuse Reporting
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/report` | Report abusive site |

#### `unsubscribe.ts` — Email Unsubscribe
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/unsubscribe?token=<jwt>` | Unsubscribe from marketing emails |

#### `site-gate.ts` — Site Auth & Context
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/site-auth` | Nginx auth_request handler (password-protected sites) |
| GET | `/api/site-context?host=<host>` | Map public host → project slug |
| GET | `/api/site-gate/:slug` | Check if site needs password |
| POST | `/api/site-gate/:slug` | Submit site password |

**site-gate logic:**
- If project has `passwordEnabled=true`: requires password cookie or form submission
- Cookie: `vibe_access_<slug>` = HMAC-SHA256(slug, passwordHash)
- Returns project title, description, and password prompt form

#### `internal-preview.ts` — Editor Preview
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/internal-preview/:id` | Serve site HTML in preview mode (before Helmet) |

**Features:**
- Token auth via query param (for iframe loading)
- Injects editor bridge script + style patches
- Allows nested stylesheet queries for style editor
- Returns 404 if site doesn't exist

---

### Protected Routes (Requires `authMiddleware`)

#### `projects.ts` — Project Management
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project details + SPA detection |
| PUT | `/api/projects/:id` | Update title, description, tags, password, metrikaId |
| DELETE | `/api/projects/:id` | Delete project + files |
| GET | `/api/projects/:id/export` | Export as ZIP |
| GET | `/api/projects/:id/qr` | Generate QR code (PNG/SVG, 200/300/500px) |

**SPA Detection:**
- Scans `index.html` for patterns: empty `<div id="root">`, `<div id="app">`, `<div id="__next">`
- Returns `isSPA: boolean` in response

#### `deploy.ts` — Deployment & Versioning
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/projects/:id/deploy` | Upload ZIP, validate, queue deploy |
| GET | `/api/projects/:id/deployments` | List last 20 deployments |
| GET | `/api/projects/:id/deployments/:deployId/status` | Get deploy status |
| GET | `/api/projects/:id/deployments/:deployId/stream` | SSE stream (deploy status polling) |
| POST | `/api/projects/:id/deploy-github` | Deploy from GitHub repo |
| GET | `/api/projects/:id/versions` | List available backup versions |
| POST | `/api/projects/:id/rollback` | Rollback to previous version |
| GET | `/api/projects/:id/files` | List files in deployed site |

**Deploy Process:**
1. POST request with ZIP file
2. Validate: file size ≤ plan limit, no forbidden extensions
3. Create deployment record (status: PENDING)
4. Return `deploymentId` immediately (async processing)
5. Background job: extract ZIP, validate structure, detect build script
6. If source project: run `npm ci --ignore-scripts && npm run build`
7. Find build output directory (dist, build, out, .output/public)
8. Move to `/var/www/vibe-hosting/sites/<slug>`, save backup
9. Update project status to LIVE, version++

**Rollback:**
- Restores from backup directory
- Respects plan version limit
- Backup current version before restore

**SSE Streaming:**
- Polls DB every 1.5 seconds
- Returns when status reaches terminal state (LIVE, FAILED, SUPERSEDED)

#### `edit.ts` — Visual Editor (pages, preview, patches, assets)
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/projects/:id/edit/pages` | List HTML files in site |
| GET | `/api/projects/:id/edit/preview` | Serve HTML with editor bridge injected |
| GET | `/api/projects/:id/edit/patches` | List active patches |
| POST | `/api/projects/:id/edit/patches` | Create patch (text, image, hide, style) |
| DELETE | `/api/projects/:id/edit/patches/:patchId` | Delete patch |
| POST | `/api/projects/:id/edit/assets/upload` | Upload asset (multer, 10MB limit) |
| GET | `/api/projects/:id/edit/assets` | List uploaded assets |

**Patch Types:**
1. **text** — Replace text content (sanitized with DOMPurify)
2. **image** — Replace `<img src>`
3. **hide** — Hide element with `display: none`
4. **style** — Apply CSS properties (whitelist: color, fontSize, fontWeight, textAlign, lineHeight, letterSpacing, textDecoration, backgroundColor, borderRadius, opacity, padding, margin, border, boxShadow, fontFamily, display)

**Asset Upload:**
- Allowed: JPEG, PNG, GIF, WebP, AVIF, WOFF, WOFF2, MP4, WebM
- Max size: 10 MB
- Filenames sanitized, stored in `/tmp` or custom upload dir

#### `domains.ts` — Custom Domain Management
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/domains` | List user's domains |
| POST | `/api/domains` | Add custom domain (PRO only) |
| POST | `/api/domains/:id/verify` | Verify DNS + auto-provision SSL |
| DELETE | `/api/domains/:id` | Deactivate custom domain |

**Domain Verification:**
- Checks A record (IP = 203.0.113.10) OR CNAME (→ hostingvibe.ru) OR TXT (`_vibe-verify.<domain>`)
- Runs certbot for SSL certificate
- Updates Nginx config + symbolic link
- Syncs canonical hosts map for redirects

**Nginx Provisioning:**
- Template: HTTP + HTTPS server blocks
- `.well-known/acme-challenge` for certbot
- Serves site from `/var/www/vibe-hosting/sites/<slug>`
- Includes nginx status map for canonical hostname redirects

#### `billing.ts` — Payment & Subscription
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/billing/status` | Get subscription status + credits |
| POST | `/api/billing/create-payment` | Create payment link (one-time or auto-renew) |
| POST | `/api/billing/webhook` | Prodamus webhook (HMAC-verified) |
| DELETE | `/api/billing/cancel` | Cancel auto-renew subscription |

**Billing Logic:**
- Payment provider: Prodamus (Yandex.Kassa-like)
- Price: 386₽/month PRO
- One-time OR recurring (auto-payment)
- User upgraded on successful payment
- Webhook: HMAC-SHA256 signature verification
- Subscription record tracks status (INACTIVE, ACTIVE, PAST_DUE, CANCELLED)
- Grace period: 3 days for PAST_DUE before downgrade
- Email notifications: upgrade, renewal, cancellation, payment failed

**Webhook Handling:**
- Idempotent via `PaymentEvent` dedup table (provider + eventId)
- Stale processing check: 10 min timeout
- Can fallback to email lookup if order_id missing
- Sends `customer_name` to Prodamus

#### `telegram.ts` — Bot Link Management
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/telegram/link` | Start Telegram bot link flow |
| GET | `/api/telegram/link/:token` | Verify bot link (callback from bot) |
| DELETE | `/api/telegram/link` | Unlink Telegram bot |

#### `admin.ts` — Admin Operations (requires `adminMiddleware`)
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/admin/stats` | System-wide statistics |
| GET | `/api/admin/users` | List all users (paginated) |
| PATCH | `/api/admin/users/:userId` | Modify user (plan, storage, admin flag) |
| POST | `/api/admin/users/:userId/reset-token-version` | Force logout all sessions |

---

## 4. Services (Core Business Logic)

### `deploy.service.ts` — Deploy & Build Pipeline
**Key Functions:**

| Function | Purpose |
|----------|---------|
| `processDeploy(deploymentId)` | Main entry point: validate ZIP → extract → detect build → run npm build → copy to sites dir → backup |
| `processGithubDeploy(projectId, repoUrl, subdir, deploymentId)` | Clone GitHub repo → detect build → npm build → deploy |
| `detectBuildProject(dir)` | Check if `package.json` has `scripts.build` |
| `findBuildOutput(dir)` | Search for `dist/`, `build/`, `out/`, `.output/public/` |
| `runBuild(dir)` | Execute `npm ci --ignore-scripts && npm run build` (3-min timeout) |
| `validateZip(buffer, maxSize)` | Check file count ≤ 5000, no forbidden extensions, no zip bombs |
| `extractZip(filePath, maxSize)` | Extract ZIP to temp dir, validate each file |
| `deleteProjectFiles(slug)` | Remove site dir + backups from disk |

**Security:**
- Strips dangerous npm hooks: `preinstall`, `postinstall`, `prepare`, `prepublish`, `prepublishOnly`, `prepack`, `postpack`
- Build env: only PATH, HOME, LANG, TERM (no DATABASE_URL, JWT_SECRET, etc.)
- 3-minute timeout per build
- Symlink removal (prevents access escapes)
- Gap: no cgroup/chroot isolation (build script can read other sites)

**Build Log Storage:**
- Truncated to 50 KB in database
- Returned on deploy status query

### `email.service.ts` — Email Delivery
**Transports:**
- Nodemailer + Yandex SMTP (configurable)
- Auth: username + password
- TLS/SSL support

**Email Templates (HTML):**

| Function | Type | Purpose |
|----------|------|---------|
| `sendWelcomeEmail(email, displayName)` | Transactional | Onboarding |
| `sendPasswordResetEmail(email, token)` | Transactional | Password reset link |
| `sendProUpgradeEmail(email, displayName)` | Lifecycle | Congratulations upgrade |
| `sendSubscriptionRenewedEmail(email, nextBillingDate)` | Lifecycle | Auto-renewal confirmation |
| `sendSubscriptionCancelledEmail(email)` | Lifecycle | Cancellation confirmation |
| `sendPaymentFailedGraceEmail(email, daysLeft)` | Transactional | Payment failed, grace period notice |
| `sendDeployNotification(email, projectTitle, url)` | Transactional | Deploy succeeded |
| `sendFormToTelegram(chatId, projectTitle, formData)` | N/A | Form submission (Telegram) |

**Template Features:**
- Branded header (Vibe + green accent)
- Unsubscribe footer (JWT token)
- HTML email with inline CSS (Yandex SMTP compatible)
- Input sanitization (`escapeHtml`)

### `analytics.service.ts` — Page View Tracking
**Functions:**

| Function | Purpose |
|----------|---------|
| `trackPageView({ slug, path, ip, userAgent, referrer })` | Record page view, dedupe by IP cooldown |
| `getProjectAnalytics(projectId, days)` | Aggregate views by date, path, referrer |

**Dedup Strategy:**
- In-memory map: key = `projectId:anonIp`
- Cooldown: 1 hour per IP per project
- Cleanup: every 5 min, max 10K entries
- If over limit: drops oldest half

**IP Handling:**
- Anonymized: zero last octet (IPv4) or last 80 bits (IPv6)
- Hashed with daily salt: `SHA256(ip + date)`
- Stored as 16-char hex prefix (not full IP)

### `email-events.service.ts` — Dedup & Idempotent Delivery
**Function:** `sendEmailOnce({ dedupeKey, eventType, recipientEmail, userId, category, payload }, sender)`

**Purpose:**
- Prevents duplicate emails (e.g., welcome sent twice if request retried)
- Tracks email events in database
- Supports categories: lifecycle, transactional, marketing, etc.

**Storage:**
- Table: `EmailEvent` (dedupeKey, sentAt, error, eventType, userId, recipientEmail)
- Unique constraint: `(dedupeKey, recipientEmail)`

### `cleanup.ts` — Background Cleanup Worker
**Tasks:**
- Delete old PENDING deployments (> 7 days)
- Clean stale upload files
- Remove superseded deployment backups (beyond plan version limit)
- Runs every hour

### `engagement-worker.ts` — Engagement Metrics
**Tasks:**
- Calculate user engagement score
- Update `lastActiveAt` timestamp
- Identify inactive users
- Runs every 24 hours

### `telegram.service.ts` — Telegram Bot Integration
**Functions:**
- `initTelegramBot()` — Start bot listener
- `sendFormToTelegram(chatId, formData)` — POST form submission
- Bot link flow: user → `/api/telegram/link` → bot prompt → callback

**Features:**
- Form submissions sent as formatted Telegram messages
- Bot link: user scans QR or clicks link, bot sends token, verify endpoint stores chatId

### `github.service.ts` — GitHub Deploy
**Function:** `processGithubDeploy(projectId, repoUrl, subdir, deploymentId)`

**Steps:**
1. Clone public GitHub repo (timeout: 5 min)
2. Optional: navigate to subdirectory
3. Detect build script in `package.json`
4. Run build (3-min timeout)
5. Deploy (same as ZIP deploy)

**Validation:**
- URL regex: `https://github.com/user/repo(.git)?`

### `domain-provision.ts` — Nginx & SSL Setup
**Functions:**

| Function | Purpose |
|----------|---------|
| `provisionDomain(hostname, slug)` | Generate Nginx config, create symlink, run certbot |
| `deprovisionDomain(hostname)` | Delete Nginx config, remove symlink |
| `syncCanonicalHostMap()` | Update Nginx map for domain→slug redirects |
| `checkARecord(hostname)` | Verify DNS A record points to server |

**Nginx Template (HTTPS):**
```
listen 443 ssl http2;
server_name example.com www.example.com;
ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
root /var/www/vibe-hosting/sites/slug;
index index.html;
location / { try_files $uri $uri/ /index.html; }
location ~ /\. { deny all; }
location __vibe_preview { ... }  # editor preview location
```

**SSL:** Let's Encrypt via certbot (HTTP-01 challenge)

### `project-operation-lock.ts` — Concurrency Control
**Function:** `acquireProjectOperationLock(projectId)`

**Purpose:** Prevent concurrent deploys/rollbacks on same project
**Implementation:** Redis-based lock (key: `project-op-lock:<projectId>`)
**Timeout:** 30 min auto-release

### `logger.ts` — Structured Logging
**Backend:** Winston
**Outputs:**
- Console: colorized, human-readable (dev mode)
- Files: JSON structured logs
  - `error.log` — error-level only
  - `combined.log` — all levels
  - 10 MB rotation, max 5 files

**Metadata:** timestamp, service name (vibe-hosting), custom fields

---

## 5. Utility Functions

### `slug.ts`
```typescript
export function validateSlug(slug: string): string | null
```
- Validates: 3-50 chars, lowercase alphanumeric + hyphens, no reserved names
- Returns error string or null

### `limits.ts`
```typescript
export function getPlanLimits(plan: Plan): { maxProjects, maxSiteSize, maxTotalStorage, maxVersions }
```

### `zip.ts`
```typescript
export async function validateZip(buffer: Buffer, maxSize: number): Promise<{ valid, error }>
export async function extractZip(filePath: string, maxSize: number): Promise<{ extractDir, error }>
```

### `shell.ts`
```typescript
export function setNginxPermissions(slug: string): void
```
- Ensures `.next/` directory readable by www-data
- `chmod 755` on frontend/.next/

### `prodamus-hmac.ts`
```typescript
export function verifySignature(body: Buffer, signature: string): boolean
export function createSignature(body: Buffer): string
```
- HMAC-SHA256 with Prodamus secret key

---

## 6. Dependencies & Versions

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | 4.21.2 | HTTP framework |
| `@prisma/client` | 6.5.0 | ORM |
| `jsonwebtoken` | 9.0.2 | JWT auth |
| `bcrypt` | 5.1.1 | Password hashing |
| `helmet` | 8.1.0 | Security headers |
| `cors` | 2.8.5 | CORS middleware |
| `express-rate-limit` | 7.5.0 | Rate limiting |
| `rate-limit-redis` | 4.2.0 | Redis rate store |
| `redis` | 5.11.0 | Redis client |
| `multer` | 1.4.5-lts.1 | File upload |
| `adm-zip` | 0.5.16 | ZIP extraction |
| `qrcode` | 1.5.4 | QR code generation |
| `nodemailer` | 8.0.1 | Email delivery |
| `node-telegram-bot-api` | 0.67.0 | Telegram bot |
| `isomorphic-dompurify` | 3.5.1 | HTML sanitization |
| `bullmq` | 5.34.0 | Job queue (optional) |
| `winston` | 3.19.0 | Logging |

**Dev:** TypeScript 5.7, tsx (TS runner), vitest (testing), supertest (HTTP testing)

---

## 7. Database Models (from Prisma schema context)

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `User` | email, passwordHash, displayName, phone, plan (FREE/PRO), tokenVersion, storageUsed, storageLimit, isAdmin, aiCredits, createdAt, lastActiveAt |
| `Project` | slug (unique), userId, title, description, status (LIVE/BUILDING/FAILED), currentVersion, sizeBytes, isPublic, tags, passwordEnabled, passwordHash, metrikaId, views, createdAt |
| `Deployment` | projectId, version, status (PENDING/LIVE/FAILED/SUPERSEDED), zipHash, sizeBytes, errorMessage, buildLog, createdAt |
| `Domain` | hostname (unique), userId, projectId, verified, verifyToken, sslStatus (PENDING/ACTIVE/FAILED), verifiedAt, createdAt |
| `Subscription` | userId (unique), status (INACTIVE/ACTIVE/PAST_DUE/CANCELLED), priceRub, prodamusSubscriptionId, currentPeriodEnd, cancelledAt |
| `PaymentEvent` | provider, providerEventId (unique), status (PROCESSING/PROCESSED/FAILED), orderId, lastError, processedAt |
| `EmailEvent` | dedupeKey, recipientEmail, eventType, userId, category, sentAt, error |
| `PageView` | projectId, path, ip (hash), userAgent, referrer, timestamp |
| `PasswordReset` | userId, token (hash), expiresAt, usedAt |
| `Patch` | projectId, type (text/image/hide/style), selector, content, createdAt |

---

## 8. Request ID & Logging

- Every request gets unique ID in `requestIdMiddleware` (UUID or X-Request-ID header)
- ID propagated through logs + error responses
- Helps correlate logs for debugging

---

## 9. Error Handling

**Global Error Handler** (`src/app/error-handler.ts`):
- Catches all thrown errors
- Logs with requestId
- Returns 500 + generic error message to client
- Prevents stack trace leakage

**HTTP Error Conventions:**
- 400: Bad request (validation)
- 401: Unauthorized (no/invalid token)
- 403: Forbidden (permission denied)
- 404: Not found (project/user/file)
- 409: Conflict (slug taken, concurrent deploy)
- 413: Payload too large (ZIP exceeds limit)
- 429: Too many requests (rate limit)
- 500: Server error (uncaught exception)
- 503: Service unavailable (payment system down)

**Special Handling:**
- 152-ФЗ compliance: account deletion is logged, cascades delete all data
- Site password gate: 401 with "password required" message
- Deploy errors: captured in `deployment.errorMessage`, returned via SSE

---

## 10. Key Architectural Patterns

### 1. **Async Processing**
- Deploy & GitHub deploy: returns immediately, processes in background
- Email sending: idempotent via dedup table, fire-and-forget with retry
- Cleanup & engagement: hourly background jobs

### 2. **Request Locking**
- Redis-based project operation lock prevents concurrent deploys
- Timeout: 30 min auto-release (prevents deadlock)
- Returns 409 Conflict if operation in progress

### 3. **Data Isolation**
- Users can only access their own projects/domains
- Query filters: `where: { userId: req.userId }`
- Admin endpoints: requires `isAdmin` flag

### 4. **HMAC Verification**
- Webhook signature: HMAC-SHA256(body, secret)
- Raw body captured before JSON parser
- Timing-safe comparison to prevent timing attacks

### 5. **Idempotency**
- Payment events: dedup via unique `(provider, providerEventId)`
- Email events: dedup via unique `(dedupeKey, recipientEmail)`
- Prevents duplicate charges / duplicate emails on retries

### 6. **Dedup Maps (In-Memory)**
- Analytics IP cooldown: 1-hour window, auto-cleanup
- Form submissions: 30-sec window, size-limited
- Prevents spam without hitting database

### 7. **Graceful Degradation**
- Redis rate limit fails: fallback to in-memory
- SMTP unavailable: health check reports `not_configured`
- Payment system down: returns 503

### 8. **Token Revocation**
- Password change increments `user.tokenVersion`
- JWT payload includes `tokenVersion`
- Auth checks: if mismatch, token is revoked
- No need to blacklist or revoke before expiry (7 days)

---

## 11. Deployment Checklist (from Memory)

**Critical Steps:**
1. `npm ci` in backend (install dependencies)
2. `npx prisma migrate deploy` (apply DB migrations)
3. **`./node_modules/.bin/tsc`** (compile TypeScript) — NOT `npx tsc` on prod
4. `npm ci` + `npm run build` in frontend
5. `chmod 755` on frontend/.next/ (Nginx www-data needs read access)
6. `PM2_HOME=/root/.pm2 pm2 restart ecosystem.config.js`
7. `PM2_HOME=/root/.pm2 pm2 save --force`
8. Health check: `curl https://hostingvibe.ru/api/health`

**Never:**
- Use `npx tsc` on production (context issues)
- Use `PM2_HOME=/opt/vibe-hosting/.pm2` (incorrect)
- Forget `pm2 save` after restart (changes lost on reboot)

---

## 12. Security Checklist

- [x] Password hashing (bcrypt, cost 10)
- [x] JWT expiry (7 days)
- [x] HTTP-only cookies (`httpOnly: true`)
- [x] CSRF protection (Origin validation for cookie auth)
- [x] Rate limiting (per-endpoint + global)
- [x] HMAC webhook verification (timing-safe compare)
- [x] HTML sanitization (DOMPurify)
- [x] Input validation (email regex, slug format, phone digits)
- [x] Token revocation (tokenVersion check)
- [x] Helmet CSP + HSTS + COEP
- [x] IP anonymization in analytics
- [x] No secrets in build env (SITES_DIR isolation)
- [x] Path traversal prevention (normalization)
- [x] Symlink removal (build artifacts)
- [ ] Cgroup/chroot for npm build (gap: malicious script could read other sites)
- [x] Nginx auth_request for password-gated sites
- [x] Canonical hostname redirects (custom domains)

---

## 13. Known Limitations & Future Improvements

| Issue | Impact | Workaround |
|-------|--------|-----------|
| No cgroup isolation for builds | Malicious npm script could read other site files | Separate container per build |
| In-memory dedup maps | Unbounded growth if cleanup fails | Max 5K-10K entry caps + TTL |
| 50 KB build log truncation | Large build logs truncated | Increase DB text field size |
| No WebSocket deploy updates | Long polling via SSE (1.5-sec interval) | Upgrade to WebSocket |
| Email idempotency via dedup | Doesn't prevent re-sends across backends | Idempotent key in transporter |
| Rate limit fallback (in-memory) | Not shared across server instances | Requires Redis HA |

---

## Summary

**VibeHosting Backend** is a production-grade Node.js + Express + Prisma platform for hosting static/SPA sites with:
- **User auth:** JWT + httpOnly cookies, password reset, account deletion
- **Project deployment:** ZIP upload, GitHub integration, auto-build, versioning, rollback
- **Visual editor:** iframe + postMessage bridge, 4 patch types, asset upload
- **Custom domains:** DNS verification, auto-SSL, Nginx provisioning
- **Billing:** Prodamus payments, subscriptions, grace period, email notifications
- **Analytics:** Page view tracking, IP anonymization, aggregated stats
- **Forms:** Telegram webhook, rate limiting, dedup
- **Security:** Helmet CSP, CORS whitelist, rate limiting, HMAC verification, token revocation

**Architecture:** Async processing (deploy, email), background workers (cleanup, engagement), in-memory dedup, Redis-backed rate limiting, Prisma ORM, structured logging.

**Key files to review:**
- `src/index.ts` (boot)
- `src/config.ts` (config)
- `src/app/create-app.ts` (middleware chain)
- `src/app/security.ts` (Helmet + CORS)
- `src/middleware/auth.ts` (JWT + CSRF)
- `src/routes/projects.ts` (CRUD)
- `src/routes/deploy.ts` (ZIP extraction + build)
- `src/routes/billing.ts` (payment webhook)
- `src/services/deploy.service.ts` (build pipeline)
- `src/services/email.service.ts` (email templates)
