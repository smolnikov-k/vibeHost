# Module Audit — 2026-03-09

## Sync Baseline

- `GitHub`: `f214762 feat(polish-cycle): full-service UX/truth alignment, auth hardening, rate-limit fix, and audit cycle tooling`
- `213.139.229.139:/root/vibecode/vibe-hosting`: source tree matches production by checksum
- `213.159.209.228:/root/vibecode/vibe-hosting`: source tree matches GitHub, plus runtime PM2 file that is now versioned as `ecosystem.config.js`

## Fixed In This Pass

1. `backend/src/index.ts` decomposed into focused bootstrap modules under `backend/src/app/*`.
2. `/api/billing/webhook` now captures `rawBody` before the global JSON parser, restoring deterministic HMAC verification.
3. ZIP deploy, GitHub deploy and rollback now share one project-level operation lock via `backend/src/services/project-operation-lock.ts`.
4. Production PM2 config from the server is now stored in `ecosystem.config.js`, so the repo reflects the deployed topology.

## Backend Modules

### App Bootstrap

| Module | Responsibility | Key dependencies | Audit status |
|---|---|---|---|
| `backend/src/index.ts` | Process entrypoint, worker startup, listen | `config`, `createApp`, workers | `ok`: reduced to orchestration only |
| `backend/src/app/create-app.ts` | Express assembly and middleware order | `express`, billing webhook router, auth middleware | `fixed`: webhook raw body moved before global parser |
| `backend/src/app/request-id.ts` | Stable request correlation ID | `crypto`, Express req/res | `ok`: isolated and reusable |
| `backend/src/app/security.ts` | `helmet` + CORS policy wiring | `helmet`, `cors`, `config` | `watch`: CORS still host-pattern based, not DB-driven |
| `backend/src/app/public-routes.ts` | Public route registration | rate limiters, public route modules | `ok`: side effects removed from entrypoint |
| `backend/src/app/protected-routes.ts` | Authenticated route registration | auth middleware, route modules | `ok`: access boundaries are explicit |
| `backend/src/app/error-handler.ts` | Final error serialization and logging | `logger` | `ok`: centralized |

### Routes

| Module | Responsibility | Key dependencies | Audit status |
|---|---|---|---|
| `backend/src/routes/health.ts` | Health probe for DB/storage/SMTP | `prisma`, `config`, email service | `ok` |
| `backend/src/routes/slug-check.ts` | Slug validation + availability | `prisma`, `validateSlug` | `ok` |
| `backend/src/routes/public-assets.ts` | Static JS widgets for hosted sites | `sendFile`, backend public assets | `ok` |
| `backend/src/routes/unsubscribe.ts` | Marketing opt-out endpoint | `jwt`, `prisma` | `ok` |
| `backend/src/routes/internal-preview.ts` | Editor preview on user subdomains | `jwt`, `prisma`, `fs` | `watch`: preview still uses token in URL |
| `backend/src/routes/auth.ts` | Registration, login, password reset, account auth | `bcrypt`, `jwt`, `prisma`, email service | `watch`: file remains large and worth domain split |
| `backend/src/routes/projects.ts` | CRUD for projects and publish state | `prisma`, deploy helpers | `ok` |
| `backend/src/routes/deploy.ts` | ZIP/GitHub deploys, rollback, file browser | `prisma`, deploy services, operation lock | `fixed`: race window reduced across all project mutations |
| `backend/src/routes/domains.ts` | Custom domain binding and verification | `prisma`, domain provision service | `watch`: infrastructure coupling still high |
| `backend/src/routes/billing.ts` | Payment links, webhook, subscription state | `prisma`, crypto, email service | `fixed`: webhook parser order corrected by app bootstrap |
| `backend/src/routes/gallery.ts` | Public gallery listing, likes, discovery | `prisma` | `ok` |
| `backend/src/routes/analytics.ts` | Public pixel ingestion and private analytics summary | `prisma`, analytics service | `ok` |
| `backend/src/routes/report.ts` | Abuse/project reports | `prisma` | `ok` |
| `backend/src/routes/pixel.ts` | Hosted-site analytics script delivery | Express router | `ok` |
| `backend/src/routes/forms.ts` | Form ingestion + Telegram forwarding | `prisma`, telegram service | `ok`: origin allowlist already enforced |
| `backend/src/routes/telegram.ts` | Telegram linking and submissions UI API | `prisma`, telegram service | `ok` |
| `backend/src/routes/edit.ts` | Visual patch CRUD and editor assets | `prisma`, fs, upload middleware | `watch`: still a large mixed-responsibility route |
| `backend/src/routes/site-gate.ts` | Password-protected site access flow | `prisma`, cookies/jwt helpers | `ok` |
| `backend/src/routes/admin.ts` | Admin statistics, moderation and reporting | `prisma` | `ok` |

### Services

| Module | Responsibility | Key dependencies | Audit status |
|---|---|---|---|
| `backend/src/services/deploy.service.ts` | Archive validation, extraction, build, deploy swap, script injection | `fs`, `prisma`, `zip`, email events | `watch`: still too large; next split target |
| `backend/src/services/github.service.ts` | Public GitHub clone deploy flow | `fs`, `prisma`, shell utils | `ok` |
| `backend/src/services/project-operation-lock.ts` | In-process lock for project mutations | in-memory `Set` | `fixed`: now shared by deploy + rollback flows |
| `backend/src/services/domain-provision.ts` | Nginx/cert/domain provisioning | shell utils, fs | `watch`: infrastructure code deserves narrower adapters |
| `backend/src/services/email.service.ts` | Transactional email composition and SMTP | nodemailer, `config` | `watch`: long file, many templates in one module |
| `backend/src/services/email-events.service.ts` | Idempotent email send gate | `prisma` | `ok` |
| `backend/src/services/cleanup.ts` | Subscription/project lifecycle maintenance | `prisma`, email services | `ok` |
| `backend/src/services/engagement-worker.ts` | Background engagement tasks | `prisma` | `ok` |
| `backend/src/services/analytics.service.ts` | Analytics aggregation and summaries | `prisma` | `ok` |
| `backend/src/services/telegram.service.ts` | Bot init and Telegram delivery | Telegram bot API, `prisma` | `watch`: external side effects and transport logic are mixed |
| `backend/src/services/logger.ts` | Central logger configuration | `winston` | `ok` |

### Utils And Types

| Module | Responsibility | Audit status |
|---|---|---|
| `backend/src/lib/prisma.ts` | Prisma singleton | `ok` |
| `backend/src/middleware/auth.ts` | JWT auth, admin gate | `ok` |
| `backend/src/middleware/rateLimit.ts` | Request throttling | `watch`: effectiveness depends on Redis deployment mode |
| `backend/src/middleware/upload.ts` | Archive upload filtering | `ok` |
| `backend/src/utils/zip.ts` | ZIP validation/extraction | `ok` |
| `backend/src/utils/shell.ts` | Shell wrappers for infra ops | `watch`: keep shell calls narrowly scoped |
| `backend/src/utils/slug.ts` | Slug policy | `ok` |
| `backend/src/utils/limits.ts` | Plan limits lookup | `ok` |
| `backend/src/types/*` | Express/global type augmentation | `ok` |

## Frontend Modules

### High-Risk Logic Modules

| Module | Responsibility | Audit status |
|---|---|---|
| `frontend/src/lib/api.ts` | Client transport, auth token storage, all domain methods | `watch`: still monolithic; best next split target on frontend |
| `frontend/src/lib/auth.tsx` | Auth context / route guard utilities | `ok` |
| `frontend/src/lib/consent.ts` | Consent storage and retrieval | `ok` |
| `frontend/src/lib/useAnimate.ts` | Shared animation hook | `ok` |
| `frontend/src/middleware.ts` | Route protection at Next edge/proxy layer | `watch`: Next 16 deprecates `middleware` naming in favor of `proxy` |
| `frontend/src/app/(dashboard)/projects/[id]/page.tsx` | Project workspace, deploy UX, file browser, settings | `watch`: biggest client-side god component |
| `frontend/src/app/(dashboard)/domains/page.tsx` | Domain onboarding and verification UX | `watch`: hardcoded server assumptions should eventually move server-side |
| `frontend/src/app/(dashboard)/settings/page.tsx` | Profile, password, Telegram and account settings | `watch`: multiple concerns in one page |
| `frontend/src/components/editor/VibeEditor.tsx` | Visual editor shell and iframe bridge | `watch`: rich interaction surface, worth splitting further |
| `frontend/src/components/editor/StyleEditor.tsx` | Editor styling controls | `ok` |

### Stable Domain Pages

| Module | Responsibility | Audit status |
|---|---|---|
| `frontend/src/app/(dashboard)/projects/new/page.tsx` | Project creation flow | `ok` |
| `frontend/src/app/(dashboard)/projects/[id]/analytics/page.tsx` | Analytics view | `ok` |
| `frontend/src/app/(dashboard)/projects/[id]/edit/page.tsx` | Editor page host | `ok` |
| `frontend/src/app/(dashboard)/projects/page.tsx` | Project listing | `ok` |
| `frontend/src/app/(dashboard)/billing/page.tsx` | Billing UI and subscription actions | `ok` |
| `frontend/src/app/(admin)/admin/*.tsx` | Admin dashboards | `ok` |
| `frontend/src/app/gallery/page.tsx` | Public gallery | `ok` |
| `frontend/src/app/ai/*` | AI landing and prompt flow | `ok` |

### Mostly Presentational Modules

| Module group | Responsibility | Audit status |
|---|---|---|
| `frontend/src/components/landing/*` | Marketing sections for the landing page | `ok`: mostly static presentational blocks |
| `frontend/src/components/cookies/*` | Consent banner UI | `ok` |
| `frontend/src/components/analytics/YandexMetrika.tsx` | Site analytics component | `ok` |
| `frontend/src/components/ErrorBoundary.tsx` | Client error boundary | `ok` |

## Remaining Risks After This Pass

1. `frontend/src/lib/api.ts` and several dashboard pages are still too large and should be split by domain/service.
2. Editor preview still relies on a query token; that is a security tradeoff not solved in this pass.
3. `backend/src/services/deploy.service.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/edit.ts`, `backend/src/services/email.service.ts` remain the main backend decomposition targets.
4. The project still uses in-process locking; if backend is ever scaled to multiple Node processes behind the same DB, the lock should move to Redis or DB-backed coordination.
