# VibeHosting Feature Audit — Implementation Roadmap

**Дата:** 2026-03-21
**Статус:** Actionable recommendations

---

## 🔴 CRITICAL (Implement ASAP)

### 1. Build Sandboxing with Container Isolation

**Problem:** `npm run build` работает без sandbox. Вредоносный скрипт может читать `/sites/*/` файлы других пользователей.

**Current Code:** `backend/src/services/deploy.service.ts:64-114`

**Implementation Options:**

#### Option A: Docker (Recommended)
```typescript
// backend/src/services/build-sandbox.ts
async function runBuildInContainer(dir: string): Promise<{...}> {
  const containerId = crypto.randomUUID();
  const imageName = 'vibe-builder:latest';

  // Run isolated build
  const result = await exec(`
    docker run \
      --rm \
      --cpus=1 \
      --memory=1g \
      -v ${dir}:/project:ro \
      -v /tmp/build-${containerId}:/output \
      --network=none \
      ${imageName} \
      npm ci && npm run build
  `, { timeout: 180_000 });

  return processOutput();
}
```

**Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /project
ENV NODE_ENV=production
RUN npm ci --ignore-scripts
RUN npm run build
```

**Pros:**
- Complete isolation
- Network disabled
- Resource limits (CPU, memory)
- No host file access

**Cons:**
- Docker daemon required
- Overhead per build (~2-5 sec)
- Image management

#### Option B: systemd-run (Lightweight)
```bash
systemd-run --scope \
  --cpuset-cpus=0 \
  --memory-limit=1G \
  -p PrivateDevices=true \
  -p PrivateTmp=true \
  -p NoNewPrivileges=true \
  npm ci && npm run build
```

**Timeline:** 5-7 days (with testing)
**Effort:** High (testing in CI/CD)
**Impact:** Eliminates build security risk

---

### 2. Rate-Limiting on All User-Facing Endpoints

**Problem:** Bruteforce, spam, DoS attacks on password, forms, likes.

**Endpoints to protect:**
- `POST /api/site-password` — bruteforce attack (currently 0 limit)
- `POST /api/forms/:slug` — spam forms
- `POST /api/gallery/:slug/like` — spam likes
- `GET /api/site-auth` — password check spam

**Implementation:**

```typescript
// backend/src/middleware/advancedRateLimit.ts
import RedisStore from 'rate-limit-redis';
import rateLimit from 'express-rate-limit';

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new RedisStore({
    client: redisClient,
    prefix: 'rl:' + options.keyGenerator?.name || 'default',
  });

  return rateLimit({
    store,
    windowMs: options.windowMs,
    max: options.maxRequests,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      });
    },
  });
}

// Usage:
const passwordLimiter = createRateLimiter({
  windowMs: 60 * 1000,           // 1 minute
  maxRequests: 5,                // 5 attempts
  keyGenerator: (req) => `${req.ip}:${req.params.slug}`,
});

const formLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,      // 1 hour
  maxRequests: 100,              // 100 forms per IP per hour
  keyGenerator: (req) => `${req.ip}:${req.params.slug}`,
});

const likeLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 10,               // 10 likes per IP per day
  keyGenerator: (req) => `${req.ip}:${req.params.slug}`,
  skipSuccessfulRequests: false,  // Count all (unlike = request too)
});

router.post('/:id/password', passwordLimiter, sitePasswordHandler);
router.post('/:slug', formLimiter, formSubmitHandler);
router.post('/:slug/like', likeLimiter, likeHandler);
```

**Database migration:**
```sql
-- Add rate_limit_config table for per-user customization
CREATE TABLE rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint VARCHAR(100),
  max_requests INT,
  window_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Timeline:** 2-3 days (implement + test)
**Effort:** Medium
**Impact:** Prevents spam/bruteforce/DoS

---

### 3. Replace In-Memory Maps with Redis

**Problem:** `guestLikes`, `recentViews`, `recentSubmissions` are unbounded, cleanup is imprecise.

**Current Code:** `backend/src/routes/gallery.ts:17-35`

**Implementation:**

```typescript
// backend/src/lib/redis-cache.ts
import Redis from 'ioredis';

const redis = new Redis(config.redisUrl);

export const cache = {
  // View dedup (IP + projectId, 1 hour TTL)
  async markView(projectId: string, ip: string): Promise<boolean> {
    const key = `view:${projectId}:${hashIp(ip)}`;
    const existed = await redis.exists(key);
    await redis.setex(key, 3600, '1');
    return existed === 0;
  },

  // Guest likes (IP + projectId)
  async getLiked(ip: string, projectId: string): Promise<boolean> {
    const key = `like:${hashIp(ip)}:${projectId}`;
    return (await redis.exists(key)) === 1;
  },

  async setLike(ip: string, projectId: string): Promise<void> {
    const key = `like:${hashIp(ip)}:${projectId}`;
    await redis.setex(key, 7 * 24 * 3600, '1'); // 7 days
  },

  // Form dedup (30 second window)
  async isDuplicateForm(slug: string, hash: string): Promise<boolean> {
    const key = `form:${slug}:${hash}`;
    const existed = await redis.exists(key);
    await redis.setex(key, 30, '1');
    return existed === 1;
  },
};

function hashIp(ip: string): string {
  return crypto.createHash('sha256')
    .update(ip + process.env.IP_SALT)
    .digest('hex')
    .slice(0, 16);
}
```

**Update endpoints to use Redis:**

```typescript
// gallery.ts
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  const slug = req.params.slug as string;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // ... lookup project ...

  // Use Redis for view dedup
  const isNewView = await cache.markView(project.id, ip);
  if (isNewView) {
    await prisma.project.update({
      where: { slug },
      data: { views: { increment: 1 } },
    });
  }

  res.json({ ...project, isLiked });
});

router.post('/:slug/like', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (req.userId) {
    // Auth user: use DB
    // ... existing logic ...
  } else {
    // Guest user: use Redis
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const liked = await cache.getLiked(ip, project.id);

    if (liked) {
      // Unlike
      await cache.deleteLike(ip, project.id);
      await prisma.project.update({
        where: { id: project.id },
        data: { likes: { decrement: 1 } },
      });
    } else {
      // Like
      await cache.setLike(ip, project.id);
      await prisma.project.update({
        where: { id: project.id },
        data: { likes: { increment: 1 } },
      });
    }
  }

  res.json({ liked: !liked, likes: project.likes + (liked ? -1 : 1) });
});
```

**Timeline:** 2-3 days
**Effort:** Medium
**Impact:** Eliminates memory bloat, adds persistence across restarts

---

## 🟡 HIGH PRIORITY (Next Sprint)

### 4. Add QR Code Generation

**Files to create/modify:**
- Backend: `backend/src/routes/projects.ts`
- Frontend: `frontend/src/app/(dashboard)/projects/[id]/components/QRModal.tsx`

**Implementation:**

```bash
npm install qrcode --save
```

```typescript
// backend/src/routes/projects.ts
import QRCode from 'qrcode';

router.get('/:id/qr', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { slug: true, domains: {
        where: { verified: true, sslStatus: 'ACTIVE' },
        select: { hostname: true },
        take: 1
      }},
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const url = project.domains[0]?.hostname
      ? `https://${project.domains[0].hostname}`
      : `https://${project.slug}.hostingvibe.ru`;

    const qrPng = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.json({
      url,
      qr: qrPng,  // data:image/png;base64,...
    });
  } catch (err) {
    logger.error('QR generation error', { error: err });
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});
```

```typescript
// frontend/src/app/(dashboard)/projects/[id]/components/QRModal.tsx
'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';

export function QRModal({ projectId, open, onClose }: Props) {
  const [qr, setQR] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/qr`);
    const data = await res.json();
    setQR(data.qr);
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Share QR Code</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {qr ? (
          <div className="space-y-4">
            <img src={qr} alt="QR Code" className="w-full" />
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = qr;
                link.download = 'qr-code.png';
                link.click();
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded"
            >
              <Download size={16} />
              Download QR Code
            </button>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate QR Code'}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Timeline:** 1 day
**Effort:** Low
**Impact:** Feature completeness

---

### 5. Add Database Indexes for Performance

**File:** `backend/prisma/schema.prisma`

```prisma
model VisualPatch {
  // ... existing fields ...

  @@index([projectId, selector])  // Add this
  @@index([projectId, enabled])   // Already exists, but verify
  @@map("visual_patches")
}

model FormSubmission {
  // ... existing fields ...

  @@index([projectId, createdAt])  // Already exists, add if missing
  @@index([projectId, formName])   // Add this
  @@map("form_submissions")
}

model PageView {
  // ... existing fields ...

  @@index([projectId, country])    // Add this
  @@index([createdAt])              // Keep for time-based queries
  @@map("page_views")
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_performance_indexes
```

**Timeline:** 1 day (migration + testing)
**Effort:** Low
**Impact:** 10-50x faster queries on patches, forms, analytics

---

### 6. Add Deployment Logging

**Database migration:**

```sql
CREATE TABLE deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL, -- EXTRACT, BUILD, DEPLOY, etc.
  level VARCHAR(20) NOT NULL, -- INFO, WARN, ERROR
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX(deployment_id, timestamp),
  INDEX(deployment_id, level)
);
```

**Implementation:**

```typescript
// backend/src/services/deploy.service.ts
class DeploymentLogger {
  constructor(private deploymentId: string) {}

  async log(stage: string, level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    await prisma.deploymentLog.create({
      data: { deploymentId: this.deploymentId, stage, level, message },
    });
  }

  async info(stage: string, message: string) {
    await this.log(stage, 'INFO', message);
  }

  async error(stage: string, err: Error) {
    await this.log(stage, 'ERROR', err.message.slice(0, 1000));
  }
}

// Usage
async function processDeploy(deploymentId: string) {
  const logger = new DeploymentLogger(deploymentId);

  logger.info('EXTRACT', 'Starting ZIP extraction...');

  try {
    const extracted = await extractZip(...);
    logger.info('EXTRACT', `Extracted ${extracted.fileCount} files`);
  } catch (err) {
    logger.error('EXTRACT', err);
    throw err;
  }

  logger.info('BUILD', 'Starting build process...');
  const buildResult = runBuild(dir);

  if (!buildResult.success) {
    logger.error('BUILD', new Error(buildResult.error));
  }

  logger.info('BUILD', 'Build completed successfully');
  logger.info('DEPLOY', 'Atomically swapping to live...');

  // ... deployment ...

  logger.info('DEPLOY', 'Deployment complete!');
}
```

**Frontend exposure:**

```typescript
// backend/src/routes/deploy.ts
router.get('/:id/deployments/:deployId/logs', async (req: AuthRequest, res: Response) => {
  const logs = await prisma.deploymentLog.findMany({
    where: { deployment: { projectId: req.params.id } },
    orderBy: { timestamp: 'asc' },
    take: 1000,
  });

  res.json(logs);
});
```

```typescript
// Frontend component
export function DeploymentLogsPanel({ deploymentId }: Props) {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments/${deploymentId}/logs`);
      setLogs(await res.json());
    }, 1000);
    return () => clearInterval(interval);
  }, [deploymentId]);

  return (
    <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className={`
          ${log.level === 'ERROR' ? 'text-red-400' : ''}
          ${log.level === 'WARN' ? 'text-yellow-400' : ''}
          ${log.level === 'INFO' ? 'text-green-400' : ''}
        `}>
          [{log.stage}] {log.message}
        </div>
      ))}
    </div>
  );
}
```

**Timeline:** 1-2 days
**Effort:** Medium
**Impact:** Better debugging, compliance

---

## 📊 Implementation Priority Matrix

```
High Impact, Low Effort:
- QR codes (1 day)
- Database indexes (1 day)
- Deployment logging (2 days)

High Impact, High Effort:
- Build sandboxing (5 days) ← START HERE
- Rate-limiting (3 days)
- Redis migration (3 days)

Medium Impact, Low Effort:
- QR codes display
- Better error messages

Maintenance:
- Documentation updates
- Test coverage
```

---

## 📈 Estimated Timeline

**Week 1:**
- [ ] Build sandboxing (Docker setup, testing) — 5 days
- [ ] Rate-limiting framework — 2 days

**Week 2:**
- [ ] Rate-limiting endpoints — 1 day
- [ ] Redis migration — 2 days
- [ ] QR code generation — 1 day

**Week 3:**
- [ ] Database indexes — 1 day
- [ ] Deployment logging — 2 days
- [ ] Testing & documentation — 2 days

**Total: ~3 weeks for all critical/high-priority items**

---

## ✅ Success Criteria

- [ ] Build sandbox running all builds (no plaintext host access)
- [ ] All user endpoints have rate-limiting (configurable)
- [ ] No in-memory unbounded maps (all in Redis)
- [ ] QR code endpoint working
- [ ] All database indexes present
- [ ] Deployment logs visible in UI
- [ ] All changes tested in staging
- [ ] Documentation updated

---

**Дата:** 2026-03-21
**Тип документа:** Implementation Roadmap
**Статус:** Ready for planning sprint
