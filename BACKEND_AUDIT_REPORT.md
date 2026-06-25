# Backend Audit Report — VibeHosting

**Date**: 2026-03-21
**Scope**: Complete audit of `/root/vibecode/vibe-hosting/backend/` (Express.js TypeScript API)
**Status**: Detailed analysis of all 19 routes, database schema, middleware, and services

---

## 1. АРХИТЕКТУРА И СТРУКТУРА

### 1.1 Стек и Фреймворки
- **Framework**: Express.js 4.21.2
- **Runtime**: Node.js (tsx for dev, tsc compilation for prod)
- **Language**: TypeScript 5.7
- **Database**: PostgreSQL (Prisma 6.5.0 ORM)
- **Cache/Session**: Redis (redis 5.11.0)
- **Authentication**: JWT (jsonwebtoken 9.0.2) + bcrypt hashing

**Key Dependencies**:
```json
{
  "bcrypt": "^5.1.1",
  "helmet": "^8.1.0", // Security headers
  "express-rate-limit": "^7.5.0",
  "multer": "^1.4.5", // File uploads
  "adm-zip": "^0.5.16", // ZIP extraction
  "nodemailer": "^8.0.1", // Email
  "node-telegram-bot-api": "^0.67.0", // Telegram
  "bullmq": "^5.34.0" // Job queue (imported but usage unclear in routes)
}
```

### 1.2 Директория Структура
```
backend/
├── src/
│   ├── app/           # Express app creation, middleware setup
│   │   ├── create-app.ts
│   │   ├── error-handler.ts
│   │   ├── protected-routes.ts
│   │   ├── public-routes.ts
│   │   ├── security.ts (Helmet, CORS)
│   │   └── request-id.ts
│   ├── middleware/
│   │   ├── auth.ts (JWT + cookie parsing)
│   │   ├── rateLimit.ts (Redis-backed rate limiters)
│   │   └── upload.ts (Multer ZIP/TAR.GZ validation)
│   ├── routes/        # 19 API endpoints (4262 lines total)
│   ├── services/      # Business logic, integrations
│   ├── utils/         # ZIP validation, slug sanitization, limits
│   ├── lib/           # Prisma, Redis clients
│   ├── types/         # TypeScript definitions
│   ├── config.ts      # Environment configuration
│   └── index.ts       # Server startup
├── prisma/
│   └── schema.prisma  # Database models (11 core models + enums)
├── package.json
└── tsconfig.json
```

---

## 2. КОНФИГУРАЦИЯ И СРЕДА

### 2.1 Environment Variables (config.ts:1-106)
**Critical Secrets**:
- `JWT_SECRET` (7-day expiry) — required, throws on missing
- `DATABASE_URL` — PostgreSQL connection, required
- `REDIS_URL` — defaults to `redis://localhost:6379/4`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- `SMTP_*` — Yandex.ru defaults, required for email

**Deployments Paths**:
```
uploadDir:   /var/www/vibe-hosting/uploads    (temp ZIP files)
sitesDir:    /var/www/vibe-hosting/sites      (extracted sites)
backupsDir:  /var/www/vibe-hosting/backups    (version backups)
```

**Limits** (config.ts:32-52):
- **FREE**: 1 project, 50 MB per site, 50 MB total storage, 3 versions
- **PRO**: 3 projects, 500 MB per site, 1 GB total, 15 versions
- ZIP bomb protection: max compression ratio 100:1
- Max files: 5000 per ZIP
- Forbidden extensions: `.php`, `.exe`, `.sh`, `.py`, `.cgi`, `.htaccess`, `.bat`, `.cmd`, `.pl`, `.jsp`, `.asp`, `.aspx`, `.rb`

**CORS**: Explicit allowlist (no wildcards)
```
['https://hostingvibe.ru', 'https://www.hostingvibe.ru']
+ dev: ['http://localhost:3000', 'http://localhost:7002']
```

---

## 3. БАЗА ДАННЫХ (Prisma Schema)

### 3.1 Core Models (11 total)

#### **User** (users table)
```sql
id (CUID)  | email UNIQUE | password_hash | displayName
plan (FREE|PRO) | storageUsed | storageLimit | aiCredits | isAdmin
tokenVersion (for token invalidation) | emailOptOut
timestamps: createdAt, updatedAt, lastActiveAt
Relations: projects[], domains[], subscription, passwordResets[], projectLikes[], telegramLink, emailEvents[]
```

#### **Project** (projects table)
```sql
id | userId FK | slug UNIQUE | title
sizeBytes | fileCount | status (UPLOADING|PROCESSING|LIVE|ERROR|SUSPENDED)
isPublic | tags[] | likes | views | currentVersion
passwordHash | passwordEnabled | metrikaId (Yandex analytics)
expiresAt (for temporary projects?)
timestamps: createdAt, updatedAt, publishedAt
Relations: deployments[], domains[], projectLikes[], pageViews[], reports[], formSubmissions[], editorPages[], visualPatches[]
```

**Status Flow**: UPLOADING → PROCESSING → LIVE (or ERROR/SUSPENDED)

#### **Deployment** (deployments table)
```sql
id | projectId FK | version INT
sizeBytes | fileCount | status (PENDING|EXTRACTING|BUILDING|LIVE|FAILED|SUPERSEDED)
errorMessage? | zipHash SHA256
timestamps: createdAt
```

#### **Domain** (custom domain mapping)
```sql
id | projectId FK | userId FK | hostname UNIQUE
verified (DNS check) | verifyToken | verifiedAt
sslStatus (PENDING|PROVISIONING|ACTIVE|FAILED|EXPIRED) | sslExpiresAt
timestamps: createdAt, updatedAt
```

#### **Subscription** (Prodamus payment tracking)
```sql
id | userId FK UNIQUE | prodamusOrderId? | prodamusSubscriptionId?
status (INACTIVE|ACTIVE|PAST_DUE|CANCELLED)
priceRub (default 386) | currentPeriodStart/End
timestamps: createdAt, updatedAt, cancelledAt
```

#### **Other Models**:
- **ProjectLike**: `(projectId, userId)` unique constraint
- **PageView**: Visitor tracking for analytics
- **Report**: Content moderation (SPAM, MALWARE, PHISHING, ILLEGAL, COPYRIGHT, OTHER)
- **FormSubmission**: Form data storage + Telegram tracking
- **EditorPage**: Visual editor page data (gjs_data JSON)
- **PasswordReset**: Token + 1-hour expiry
- **TelegramLink**: User ↔ Telegram chat binding
- **EmailEvent**: Idempotent email sending (dedupeKey, status tracking)
- **PaymentEvent**: Webhook deduplication (provider + providerEventId unique)
- **VisualPatch**: CSS/text inline edits (selector, xpath, type, content)

**Indexes**: Good coverage on FK, unique, and query columns (slug, status, createdAt).

---

## 4. AUTHENTICATION & SECURITY

### 4.1 JWT Implementation (middleware/auth.ts)

**Token Structure**:
```typescript
{
  userId: string,
  email: string,
  tokenVersion?: number,  // For revocation
}
```
- **Algorithm**: HS256
- **Expiry**: 7 days (config.jwtExpiresIn)
- **Secret**: `config.jwtSecret` from env

**Token Sources** (priority):
1. Authorization Bearer header
2. `vibe_token` httpOnly cookie
3. Legacy `?token=` query param (deprecated, logged + header warning)

### 4.2 Middleware

**optionalAuth** (optional-auth.ts:93-115)
- Sets `req.userId` if valid token present
- Continues as anonymous on invalid token
- Checks `tokenVersion` against DB to support token revocation

**authMiddleware** (required auth)
- Returns 401 if no token
- Validates `tokenVersion` against DB (rejecting revoked tokens)
- CSRF protection: For mutating requests (POST/PUT/PATCH/DELETE) with cookie auth, enforces Origin allowlist
  - **SECURITY**: Cookie-based auth on custom origins returns 403
  - Prevents CSRF attacks from attacker-controlled domains

**adminMiddleware**
- Requires `user.isAdmin = true`
- Returns 403 if not admin

**Cookie Security** (auth.ts:71-78):
```typescript
res.cookie('vibe_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: process.env.NODE_ENV === 'production' ? '.hostingvibe.ru' : undefined,
});
```
✅ **Good**: httpOnly prevents XSS token theft, secure flag, strict SameSite

### 4.3 Rate Limiting (middleware/rateLimit.ts)

Redis-backed (with in-memory fallback):
- **Login**: 10/15min per IP
- **Register**: 5/15min per IP
- **Site Gate (password)**: 10/15min per IP
- **Deploy**: 5/1hour per IP
- **API (general)**: 100/1min per IP
- **Forgot Password**: 3/15min per IP
- **Reset Password**: 5/15min per IP

**SECURITY**: If Redis unavailable, falls back to in-memory (not distributed across instances).

---

## 5. API ENDPOINTS (19 routes, 4262 LOC)

### 5.1 Authentication Routes (auth.ts)

#### POST /register
- **Rate limit**: 5/15min
- **Validation**:
  - Email format check: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - Password: min 8 chars, at least 1 letter + 1 digit
  - displayName: HTML sanitized (`replace(/<[^>]*>/g, '')`)
- **Process**:
  1. Hash password (bcrypt 10 rounds)
  2. Create user with Plan=FREE, storageLimit=50MB
  3. Generate JWT with tokenVersion
  4. Set httpOnly cookie
  5. Send welcome email (fire-and-forget via sendEmailOnce)
- **Response**: token + user object (no passwordHash)

**ISSUES**:
- displayName sanitization is basic (regex strip) but OK for stored names

#### POST /login
- **Rate limit**: 10/15min
- **Process**:
  1. Lookup user by email
  2. bcrypt.compare password
  3. Check user.isAdmin, subscription status
  4. Generate JWT with tokenVersion
  5. Set cookie
- **Response**: token + user object

#### POST /forgot-password
- **Rate limit**: 3/15min
- **Process**:
  1. Create PasswordReset record with 1-hour expiry
  2. Send email with reset link
- **Response**: success message

#### POST /reset-password
- **Rate limit**: 5/15min
- **Process**:
  1. Lookup PasswordReset by token
  2. Check expiry + not already used
  3. Hash new password
  4. Update user.passwordHash + user.tokenVersion (revokes old tokens!)
  5. Mark reset as used
- **Response**: success
- **SECURITY**: Token invalidation via tokenVersion increment is good

#### POST /logout (implicit)
- No explicit logout — relies on token expiry or manual cookie deletion on client

### 5.2 Projects Routes (projects.ts)

#### GET /projects
- **Auth**: required
- **Response**: User's projects with: id, slug, title, status, tags, likes, views, customDomain (first verified SSL domain), deployments count, domains count

#### POST /projects
- **Auth**: required
- **Validation**:
  - title: max 100 chars
  - slug: validateSlug() → `/^[a-z0-9][-a-z0-9]*$/`
  - description: max 500 chars
- **Limits**: Free=1, Pro=3 projects (enforced)
- **Process**:
  1. Check slug not reserved (from config.reservedSlugs)
  2. Check slug not taken
  3. Create project with status=UPLOADING
- **Response**: project object

#### GET /projects/:id
- **Auth**: required
- **Verification**: Owner check
- **Response**: Full project details

#### PUT /projects/:id
- **Auth**: required
- **Fields**: title, description, isPublic, tags, metrikaId, expiresAt
- **Validation**: Same as POST (title, description limits)

#### DELETE /projects/:id
- **Auth**: required
- **Process**:
  1. Delete project files from disk
  2. Cascade deletes: deployments, domains, reports, forms, editor pages, patches
- **Response**: success

#### POST /projects/:id/publish
- **Auth**: required
- **Process**: Set project.isPublic = true, publishedAt = now()

#### POST /projects/:id/set-password
- **Auth**: required
- **Process**:
  1. Hash password (bcrypt 10 rounds)
  2. Update project.passwordHash + passwordEnabled
- **Response**: success

#### POST /projects/:id/unset-password
- **Auth**: required
- **Process**: Clear passwordHash, passwordEnabled = false

### 5.3 Deployment Routes (deploy.ts)

#### POST /projects/:id/deploy (ZIP upload)
- **Rate limit**: 5/1hour
- **File**: multipart `file` field (ZIP or TAR.GZ)
- **Validation**:
  1. File size ≤ plan limit (Free=50MB, Pro=500MB)
  2. ZIP/TAR.GZ format (validateZip or validateExtractedDir)
  3. No forbidden extensions (.php, .sh, etc.)
  4. Max 5000 files
  5. Max 100:1 compression ratio (ZIP bomb protection)
  6. Must contain index.html or package.json (for build)
- **Process**:
  1. Calculate SHA256 hash of archive
  2. Create Deployment record (version = currentVersion + 1)
  3. Rename uploaded file to `${deploymentId}.zip`
  4. Return 200 with deploymentId + version
  5. **Background**: processDeploy() async (non-blocking, releases lock when done)
    - Update status: EXTRACTING → BUILDING → LIVE (or FAILED)
    - Extract to temp dir
    - Remove symlinks (path traversal protection)
    - Auto-detect build (package.json + npm run build)
    - Find build output (dist/, build/, out/, .output/public/)
    - Calculate sizeBytes + fileCount
    - Copy to `/var/www/vibe-hosting/sites/${slug}/`
    - Create backup in `/var/www/vibe-hosting/backups/${slug}/v${version}/`
    - Cleanup old backups (keep only maxVersions)
    - Inject scripts: forms, patches, Yandex Metrika
    - Update project.status = LIVE
    - Send deploy notification email
- **Lock**: Project operation lock (Redis-based?) prevents concurrent deploys
- **Response**: `{ deploymentId, version, status: 'PENDING' }`

**SECURITY NOTES**:
✅ ZIP bomb protection: compression ratio check
✅ Forbidden extensions: blocks .php, .sh, .py, .cgi (code execution)
✅ Symlink removal: prevents path traversal
✅ Build environment sanitization: safeEnv strips DATABASE_URL, JWT_SECRET, etc.
✅ Max 3-min timeout on npm build (prevents resource exhaustion)

⚠️ **Known Gap**: No cgroup/chroot isolation for npm build — a malicious package.json could:
  - Read files from other sites in SITES_DIR
  - Make outbound network requests
  - Future: sandbox via systemd-run or container-per-build

#### GET /projects/:id/deployments
- **Auth**: required, owner
- **Response**: Last 20 deployments (version, status, errorMessage, createdAt)

#### GET /projects/:id/deployments/:deployId/status
- **Auth**: required, owner
- **Response**: `{ status, errorMessage? }`

#### GET /projects/:id/deployments/:deployId/stream (SSE)
- **Auth**: required, owner
- **Process**: Server-sent events, streams status until terminal state
- **Response**: `event: status\ndata: {"status":"LIVE"}`

### 5.4 Domains Routes (domains.ts)

#### POST /domains (add custom domain)
- **Auth**: required, PRO plan only
- **Validation**:
  - Hostname format: `/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/`
  - Hostname not already registered
- **Process**:
  1. Generate random UUID for verification
  2. Create Domain record (verified=false, sslStatus=PENDING)
- **Response**: domain object + DNS instructions (A + TXT records)

**Instructions**:
```
A: @ → 203.0.113.10
TXT: _vibe-verify.example.com → {verifyToken}
```

#### POST /domains/:id/verify (DNS + SSL check)
- **Auth**: required, owner
- **Process**:
  1. Check A record points to 203.0.113.10
  2. Check CNAME points to hostingvibe.ru
  3. If not verified, skip (keep trying)
  4. If verified:
     - Update domain.verified = true, verifiedAt = now()
     - Call provisionDomain() → Nginx config generation + certbot ACME
  5. If SSL provisioning succeeds, sslStatus = ACTIVE
- **Response**: `{ verified, sslStatus }`

#### DELETE /domains/:id
- **Auth**: required, owner
- **Process**:
  1. deprovisionDomain() → Remove Nginx config, revoke certbot
  2. Delete Domain record
- **Response**: success

### 5.5 Editor Routes (edit.ts)

#### GET /projects/:id/pages (list pages with visual editor data)
- **Auth**: required, owner
- **Response**: List of EditorPage records (path, gjsData, updatedAt)

#### POST /projects/:id/pages (save/update editor page)
- **Auth**: required, owner
- **Body**: `{ path, gjsData }`
- **Path validation**: No `..` or leading `/`
- **Process**:
  1. Upsert EditorPage (unique: projectId + path)
  2. Store gjsData as JSON
- **Response**: updated EditorPage

#### POST /projects/:id/visual-patches (create visual patch for live sites)
- **Auth**: required, owner
- **Patches**: Text replacement, image replacement, hide element
- **Validation**:
  - Selector: max 500 chars, no `<>{}` or `javascript:` injection
  - Content: CSS properties or URLs only (ALLOWED_STYLE_PROPS whitelist)
- **Process**:
  1. Store VisualPatch (selector, xpath?, type, content, enabled, order)
- **Response**: created patch

**Patch Types**:
- `text`: Replace text content
- `image`: Replace `src` attribute
- `style`: Inject CSS properties (color, fontSize, fontWeight, etc.)
- `hide`: Display: none

**SECURITY**: Whitelist CSS properties prevents arbitrary CSS injection

#### POST /assets/upload (upload image/font/video for editor)
- **Auth**: required, owner
- **Multer limits**: 10 MB per file
- **Allowed**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `font/woff*`, `video/mp4`, `video/webm`
- **Process**: Store to `/tmp` with sanitized filename
- **Response**: uploaded file URL

### 5.6 Forms Routes (forms.ts)

#### POST /api/forms/:slug (public form submission)
- **Auth**: none (public)
- **CORS**: Custom middleware — allows *.hostingvibe.ru + verified custom domains only
- **Deduplication**: In-memory Map, 30-second window, max 5000 entries
- **Process**:
  1. Lookup project by slug
  2. Check project.status == 'LIVE'
  3. Extract form fields (max 20 fields, max 2048 chars per value)
  4. Internal fields (`_vibe_*`) excluded
  5. Create FormSubmission record
  6. Send to Telegram via sendFormToTelegram()
- **Response**: `{ ok: true }` or error
- **Dedup key**: IP + projectId + hash(formData)

**SECURITY**:
✅ Rate limiting via dedup window (not IP-based, so OK for shared networks)
⚠️ Dedup via in-memory Map — not distributed, cleared on restart

### 5.7 Billing Routes (billing.ts)

#### GET /billing/status
- **Auth**: required
- **Response**: User's plan, subscription status, priceRub, currentPeriodEnd

#### POST /billing/start-subscription (Prodamus payment form URL)
- **Auth**: required, FREE plan only
- **Process**:
  1. Check user is FREE
  2. Create/update Subscription record (status=INACTIVE)
  3. Generate Prodamus payment form URL with HMAC signature
- **Response**: `{ orderId, paymentUrl }`

#### POST /billing/webhook (Prodamus IPN)
- **Auth**: none (webhook from Prodamus)
- **HMAC verification**: Uses config.prodamus.secretKey
- **Idempotent**: PaymentEvent table tracks provider_providerEventId (unique)
- **Process**:
  1. Parse webhook (JSON or form-encoded)
  2. Verify HMAC signature
  3. Claim PaymentEvent (idempotent insert or skip if already processed)
  4. Extract orderId from webhook
  5. Update Subscription (status=ACTIVE, currentPeriodStart/End)
  6. Update User (plan=PRO, storageLimit=1GB, aiCredits=100)
  7. Send pro-upgrade email
- **Response**: 200 OK

**SECURITY**:
✅ HMAC verification prevents spoofing
✅ Idempotent processing via unique constraint
⚠️ Prodamus webhook timing: Must handle duplicate/late deliveries

#### POST /billing/cancel-subscription
- **Auth**: required, PRO plan
- **Process**:
  1. Update Subscription (status=CANCELLED, cancelledAt=now())
  2. Downgrade User (plan=FREE on cancellation or at period end?)
  3. Send cancellation email
- **Response**: success

### 5.8 Analytics Routes (analytics.ts)

#### POST /analytics/track (pixel tracking, public)
- **Auth**: none
- **Body**: `{ slug, path?, referrer? }`
- **Process**:
  1. Create PageView record (ip, userAgent, referrer, country)
  2. Lookup project to increment views
- **Response**: `{ ok: true }`

#### GET /projects/:id/analytics (dashboard analytics, protected)
- **Auth**: required, owner
- **Query**: `days` (1-90, default 30)
- **Response**: PageView stats by date/path/country

### 5.9 Other Routes

#### GET /health
- **Auth**: none
- **Response**: `{ status: 'ok' }` — health check for uptime monitoring

#### GET /site-auth (Nginx auth_request handler)
- **Auth**: none (called by Nginx)
- **Process**: Check if site is password-protected; return 200 (OK) or 401 (password needed)

#### GET /site-context (cross-origin helper)
- **Auth**: none
- **CORS**: `*` (public)
- **Response**: Project slug + custom domain mapping

#### POST /report (content moderation, public)
- **Auth**: none, rate-limited per IP (3 per day)
- **Reasons**: SPAM, MALWARE, PHISHING, ILLEGAL, COPYRIGHT, OTHER
- **Process**:
  1. Hash reporter IP (SHA256) for privacy
  2. Create Report record
  3. Log to admin dashboard
- **Response**: success

#### GET /internal/preview (live preview for authenticated owner)
- **Auth**: required (cookie/bearer/legacy query)
- **Process**: Serve HTML from `/var/www/vibe-hosting/sites/${slug}/` with auth gate
- **Response**: HTML file

#### POST /api/unsubscribe (email opt-out)
- **Query**: `token` (JWT signed with email + action=unsubscribe)
- **Process**: Set user.emailOptOut = true
- **Response**: success

---

## 6. SERVICES & UTILITIES

### 6.1 Deploy Service (services/deploy.service.ts)

**Key Functions**:

1. **validateZip(zipPath, maxSize)** — checks:
   - File count ≤ 5000
   - Size ≤ plan limit
   - Compression ratio ≤ 100:1 (ZIP bomb)
   - No forbidden extensions
   - Contains index.html or package.json
   - No path traversal (`..`, `/`)

2. **extractZip(zipPath, destDir, rootPrefix)** — safely extracts:
   - Skips ignored files (.git, .env, etc.)
   - Path traversal check: `!resolved.startsWith(path.resolve(destDir))`
   - Writes files to destination

3. **detectBuildProject(dir)** — detects package.json + build script

4. **runBuild(dir)** — npm ci/install + npm run build:
   - **Safe env**: PATH, HOME, LANG only (DATABASE_URL, JWT_SECRET stripped)
   - **3-minute timeout**
   - **Removes dangerous npm hooks**: preinstall, postinstall, prepare, etc.
   - **--ignore-scripts** flag prevents hook execution during install
   - ⚠️ Still allows arbitrary code in `npm run build` script body (mitigated by timeout)

5. **processDeploy(deploymentId)** — main deployment orchestration:
   - Extract archive (ZIP or TAR.GZ)
   - Optional build (npm build)
   - Find build output (dist/, build/, out/)
   - Validate extracted files
   - Move to `/var/www/vibe-hosting/sites/${slug}/`
   - Create backup in `/var/www/vibe-hosting/backups/${slug}/v${version}/`
   - Cleanup old backups (plan limit)
   - Inject scripts (forms, patches, Metrika)
   - Update project status to LIVE

6. **injectVibeFormsScript()** — adds form submission listener
7. **injectVibePatchesScript()** — applies visual patches (CSS, text, hide)
8. **injectYandexMetrika()** — injects Metrika tracking code

### 6.2 GitHub Deploy Service (services/github.service.ts)

**processGithubDeploy(projectId, repoUrl, subdir?, existingDeploymentId?)** — clones public GitHub repo:
- Uses `git clone --depth 1` (shallow, safe)
- Finds index.html or build output
- Same validation + injection as ZIP deploy
- Clones to `/tmp/vibe-github-${projectId}-${timestamp}/`

### 6.3 Domain Provisioning (services/domain-provision.ts)

**provisionDomain(hostname, slug)** — creates Nginx config + SSL:
1. Generate Nginx config block (HTTP 80 for certbot, then HTTPS 443)
2. Write to `/etc/nginx/sites-available/${hostname}`
3. Symlink to `/etc/nginx/sites-enabled/`
4. Run `certbot certonly --webroot --domain ${hostname}`
5. Update NGINX_CANONICAL_HOSTS_MAP for hostname → slug routing
6. Reload Nginx

**deprovisionDomain(hostname)** — teardown:
1. Remove Nginx config
2. Revoke certbot certificate
3. Remove symlink

### 6.4 Telegram Service (services/telegram.service.ts)

**initTelegramBot()** — polling bot for user linking:
- `/start {linkCode}` — Links user's Telegram chat to VibeHosting account
- `/status` — Shows linked user + active projects
- `/help` — Command list

**sendFormToTelegram(...)** — Posts form submission to user's Telegram chat

### 6.5 Email Service (services/email.service.ts)

**Transporter**: Nodemailer + SMTP (Yandex.ru default)

**Transactional Emails**:
- sendPasswordResetEmail(email, token) — 1-hour expiry reset link
- sendWelcomeEmail(email, displayName)
- sendProUpgradeEmail(email) — subscription activated
- sendSubscriptionCancelledEmail(email)
- sendDeployNotification(email, slug, version, status)

**Email Events Service** — Idempotent deduplication (sendEmailOnce):
- dedupeKey (unique): `${eventType}:${recipientEmail}:${payloadHash?}`
- Prevents duplicate emails on retry
- Stores attempt count, last error

### 6.6 Analytics Service (services/analytics.service.ts)

**trackPageView(slug, path, ip, userAgent, referrer)** — logs to PageView table

**getProjectAnalytics(projectId, days)** — aggregates:
- Views by date
- Top pages
- Top referrers
- Geographic distribution (if IP2Location available)

### 6.7 Utilities

**limits.ts**: Returns config.free or config.pro based on user plan

**zip.ts**: ZIP validation + extraction (covered above)

**slug.ts**: Validates slug format + checks reserved names

**shell.ts**: Safe shell command execution (spawnSync, no shell interpolation)

**prodamus-hmac.ts**: HMAC-SHA256 verification for Prodamus webhooks

---

## 7. SECURITY ANALYSIS

### 7.1 ✅ STRENGTHS

1. **Authentication**:
   - JWT with HS256 (not RS256, but acceptable for single-service architecture)
   - Token versioning for revocation support
   - httpOnly, secure, strict SameSite cookies
   - CSRF protection via Origin header validation for cookie-based requests

2. **Authorization**:
   - Owner checks on all sensitive operations (projects, domains, forms)
   - Plan-based feature gating (FREE vs PRO)
   - Admin role enforcement

3. **Input Validation**:
   - Email format regex
   - Password complexity (8+ chars, letter + digit)
   - Slug format validation
   - Path traversal checks (`..`, `/` in paths)
   - Hostname format validation (domains)
   - CSS selector + property whitelisting (patches)

4. **File Upload Safety**:
   - ZIP bomb protection (100:1 compression ratio)
   - File type whitelist (only ZIP/TAR.GZ)
   - Max file count (5000)
   - Forbidden extensions (.php, .sh, .py, etc.)
   - Symlink removal (prevents path traversal)
   - Path traversal check on extraction: `resolved.startsWith(destDir)`

5. **Build Environment**:
   - Safe env vars (DATABASE_URL, JWT_SECRET stripped)
   - Dangerous npm hooks removed
   - 3-minute timeout on npm build
   - --ignore-scripts flag during install

6. **Rate Limiting**:
   - Redis-backed (with in-memory fallback)
   - Per-endpoint limits (login, register, deploy, etc.)
   - Good granularity (IP-based)

7. **Security Headers**:
   - Helmet.js (CSP, HSTS, X-Frame-Options, etc.)
   - CORS explicit allowlist (no wildcards)

8. **Password Management**:
   - bcrypt 10 rounds
   - Password reset tokens with 1-hour expiry
   - Token invalidation via tokenVersion

9. **Webhook Integrity**:
   - HMAC-SHA256 verification (Prodamus)
   - Idempotent processing (PaymentEvent unique constraint)

### 7.2 ⚠️ CONCERNS & GAPS

#### **1. Build Sandbox**
- **Issue**: `npm run build` executes arbitrary user code (package.json scripts)
- **Current Mitigations**:
  - Safe env vars (partial, doesn't prevent script reading other files)
  - 3-minute timeout (prevents indefinite loops)
  - --ignore-scripts on install (only for install hooks)
- **Gap**: No cgroup/chroot/container isolation
  - Malicious build script could:
    - Read files from other user sites in SITES_DIR
    - Make outbound network requests (exfil data, DDoS)
    - CPU/memory exhaustion (despite timeout)
- **Recommendation**: Use systemd-run with PrivateTmp/PrivateDevices or OCI container per build

#### **2. Symlink Handling**
- **Code**: removeSymlinks() called on tar.gz extraction
- **ZIP**: No symlink removal documented (zip entries shouldn't contain symlinks, but verify)
- **Recommendation**: Explicit check/error on ZIP symlinks

#### **3. Rate Limiting Distribution**
- **Issue**: Redis fallback to in-memory storage
- **Gap**: Horizontal scaling — if 2 servers, each has separate in-memory store → rate limits not enforced across fleet
- **Recommendation**: Ensure Redis is always available (required dependency)

#### **4. Email Deduplication**
- **Issue**: In-memory dedup map for form submissions (30-second window)
- **Gap**: Multi-server deployment → duplicates possible
- **Recommendation**: Use database (dedupeKey in FormSubmission table)

#### **5. CORS on /forms**
- **Implementation**: Custom middleware checks origin against DB (domain.verified)
- **Gap**: DNS can be spoofed client-side if attacker controls requestor's DNS
- **Accepted Risk**: Client-side CORS can't be enforced server-side (it's a browser feature)

#### **6. Password Hashing for Site Passwords**
- **Code**: sites use bcrypt, same as user passwords ✅
- **Stored in**: project.passwordHash
- **Auth**: Cookie-based HMAC token (site-gate.ts) ✅

#### **7. Path Traversal in Editor**
- **Code**: pagePath validation checks `!pagePath.includes('..')` ✅
- **Gap**: Null bytes? (unlikely in Node.js, but verify)

#### **8. Telegram Bot Linking**
- **Link code**: Random UUID ✅
- **Expiry**: Not enforced (code persists until used)
- **Recommendation**: Add TTL (e.g., 15 minutes)

#### **9. Project Expiry**
- **Column**: project.expiresAt (nullable)
- **Usage**: Not found in codebase — unclear if enforced
- **Recommendation**: Implement cleanup job

#### **10. Email Opt-Out**
- **Implemented**: user.emailOptOut flag ✅
- **Usage**: Not checked in services (email sending doesn't respect flag)
- **Recommendation**: Check flag in sendDeployNotification(), etc.

---

## 8. DATABASE INTEGRITY

### 8.1 Migrations & Schema

**Prisma**: PostgreSQL provider, 6.5.0 version
**Indexes**: Well-designed
- Foreign keys with CASCADE delete (projects deleted → deployments, forms, etc. cascade)
- Unique constraints on: email, slug, hostname, (projectId, userId), etc.
- Composite indexes on query columns (userId + createdAt, projectId + status, etc.)

### 8.2 Transaction Safety

**Concern**: No explicit transactions observed in codebase
- **Deploy process**: Multiple DB writes (project.status, deployment.status, etc.) without transaction
  - **Risk**: Partial failure could leave DB inconsistent
  - **Mitigation**: Background job approach (processDeploy) + status tracking
  - **Recommendation**: Wrap in Prisma transaction

**Example**:
```typescript
await prisma.$transaction(async (tx) => {
  await tx.deployment.update(...);
  await tx.project.update(...);
});
```

---

## 9. API PATTERNS & CONVENTIONS

### 9.1 Response Format

**Errors**:
```json
{ "error": "message", "requestId": "uuid", "code"?: "CONSTANT" }
```

**Success**:
```json
{ "data": {...} } or { "result": [...] } or { "status": "ok" }
```

⚠️ **Inconsistency**: No unified response wrapper (some return nested data, some don't)

### 9.2 Request IDs

- **Middleware**: requestIdMiddleware generates UUID for each request
- **Logging**: Included in error logs for tracing
- **Response**: Included in error responses (good for debugging)

### 9.3 Validation

- Input sanitization: HTML strip on displayName
- String length limits: enforced
- Enum validation: hardcoded lists (VALID_REASONS, etc.)
- ⚠️ **Gap**: No schema validation library (joi, yup, zod) — validation scattered across routes

---

## 10. PERFORMANCE OBSERVATIONS

### 10.1 Database Queries

**Good**:
- Selective include/select (not fetching passwords, huge relations)
- Indexes on common queries (slug, status, createdAt, etc.)
- Limit queries (paginated gallery, last 20 deployments, etc.)

**Potential Issues**:
- Project gallery (GET /) can query many projects — pagination good but orderBy might scan
- analytics (getProjectAnalytics) — no limit on PageView queries, could be slow for high-traffic projects

### 10.2 File Operations

**ZIP Extraction**:
- Streaming hash calculation (good for large files)
- No full-file loading into memory for validation ✅

**Build Process**:
- 3-minute timeout prevents runaway processes
- Temp directories cleaned up (via fs.rmSync)

### 10.3 Background Jobs

**processDeploy**:
- Non-blocking (async background task)
- Project operation lock prevents concurrent deploys
- ⚠️ BullMQ imported but no visible usage — unclear if job queue is used

---

## 11. DEPLOYMENT & INFRASTRUCTURE INTEGRATION

### 11.1 Nginx Auth Gateway

**site-auth handler** (GET /api/site-auth):
- Called by Nginx `auth_request` for password-protected sites
- Returns 200 (allow) or 401 (require password)
- Cookie-based HMAC token validation

**Nginx Config** (generated by domain-provision):
```nginx
auth_request /api/site-auth;
auth_request_set $auth_status $upstream_status;
```

### 11.2 Static File Serving

**Manual file serving** via internal-preview endpoint (dev/preview only)
**Production**: Nginx directly serves `/var/www/vibe-hosting/sites/${slug}/`

### 11.3 SSL/TLS

**Certbot integration**:
- Domain verification: DNS A-record + TXT record check
- ACME HTTP-01 challenge: certbot webroot at `/root/vibecode/certbot_webroot`
- Auto-renewal: systemd timer (assumed, not shown in backend)

---

## 12. AUDIT FINDINGS SUMMARY

### **Critical Issues**: 0
- No SQL injection (Prisma parameterized queries)
- No unauthenticated admin access
- No exposed secrets in code

### **High-Risk Concerns**: 2
1. **Build Sandbox**: No cgroup/container isolation for npm build
2. **Rate Limiting Distribution**: In-memory fallback not distributed

### **Medium Concerns**: 5
1. Email opt-out flag not enforced
2. Form dedup in-memory (not distributed)
3. No explicit database transactions
4. Telegram link codes lack TTL
5. Project expiry column unused

### **Low/Best-Practice**: 3
1. No schema validation library (scattered validation)
2. Inconsistent API response formats
3. BullMQ imported but unused

---

## 13. RECOMMENDATIONS

### **Immediate Actions** (security):
1. ✅ Verify email opt-out flag is checked before sending emails
2. ✅ Add TTL to telegram linkCode (Redis 15min expiry)
3. ✅ Wrap deploy process in database transaction

### **Short-term** (reliability):
1. Move form dedup to database (FormSubmission uniqueness)
2. Implement project expiry cleanup job
3. Add schema validation (Zod or similar)

### **Medium-term** (infrastructure):
1. Isolate build environment (systemd-run + PrivateTmp or OCI container)
2. Ensure Redis availability (not optional)
3. Add metrics collection (deploy success/failure rates, email sending status)

### **Long-term** (architecture):
1. Consolidate API response format (use wrapper: `{ data, error, requestId }`)
2. Extract validation into shared middleware/utilities
3. Consider OIDC for Telegram linking (better UX, standardized)

---

## 14. ATTACHMENT: ROUTE SUMMARY TABLE

| Route | Method | Auth | Rate Limit | Purpose |
|-------|--------|------|------------|---------|
| /register | POST | No | 5/15m | User signup |
| /login | POST | No | 10/15m | User login |
| /forgot-password | POST | No | 3/15m | Password reset request |
| /reset-password | POST | No | 5/15m | Password reset (token) |
| /projects | GET | Yes | - | List user projects |
| /projects | POST | Yes | - | Create project |
| /projects/:id | GET/PUT/DELETE | Yes | - | Project CRUD |
| /projects/:id/deploy | POST | Yes | 5/1h | Upload ZIP → deploy |
| /projects/:id/deployments | GET | Yes | - | List deployments |
| /domains | POST | Yes (PRO) | - | Add custom domain |
| /domains/:id/verify | POST | Yes | - | Verify DNS + SSL |
| /projects/:id/pages | GET/POST | Yes | - | Visual editor pages |
| /projects/:id/visual-patches | POST | Yes | - | Add visual patch |
| /assets/upload | POST | Yes | - | Upload media |
| /forms/:slug | POST | No | In-mem | Form submission |
| /billing/status | GET | Yes | - | Subscription info |
| /billing/start-subscription | POST | Yes | - | Initiate payment |
| /billing/webhook | POST | No | - | Payment IPN (HMAC) |
| /analytics/track | POST | No | - | Pixel tracking |
| /projects/:id/analytics | GET | Yes | - | View analytics |
| /health | GET | No | - | Health check |
| /site-auth | GET | No | - | Nginx auth gate |
| /report | POST | No | 3/day | Content report |
| /internal/preview | GET | Yes | - | Live preview |

---

**Audit Completed**: 2026-03-21
**Next Steps**: Review findings with team, prioritize fixes, implement sandbox isolation for builds
