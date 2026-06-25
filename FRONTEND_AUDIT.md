# VibeHosting Frontend — Comprehensive Audit

**Last Updated:** 2026-03-21

---

## 1. DEPENDENCIES & BUILD CONFIGURATION

### package.json
- **Framework:** Next.js 16.1.6 with React 19.2.4
- **TypeScript:** 5.9.3
- **Styling:** Tailwind CSS 4.2.1 via @tailwindcss/postcss
- **Dev port:** 7002 (custom)
- **Key deps:**
  - `animejs` 4.3.6 — animations (named exports, e.g., `animate()`)
  - `lucide-react` 0.575.0 — icons
  - `qrcode.react` 4.2.0 — QR code generation
- **Scripts:**
  - `npm run dev` — Next.js dev with Turbopack on port 7002
  - `npm run build` — Production build
  - `npm start` — Start server on port 7002

### next.config.ts
- Disables X-Powered-By header
- Turbopack root configured
- **Redirects:**
  - `/projects/:id/editor` → `/projects/:id/edit` (permanent)
  - `/projects/:id/patches` → `/projects/:id/edit` (permanent)

### tailwind.config
- **Not found** — Tailwind v4 uses PostCSS-only configuration via @tailwindcss/postcss plugin
- Emerald (green-500/600) is the primary accent color
- All typography is Inter font from Google Fonts (Latin + Cyrillic)

### postcss.config.mjs
- Uses @tailwindcss/postcss plugin only

---

## 2. MIDDLEWARE & ROUTING

### src/middleware.ts
**Purpose:** Route protection & auth redirects
- **Protected prefixes** (require vibe_token cookie):
  - `/projects/*`
  - `/settings`
  - `/billing`
  - `/domains`
  - `/admin`
- **Auth pages** (redirect to /projects if logged in):
  - `/login`, `/register`, `/forgot-password`, `/reset-password`
- **Mechanism:** Checks `vibe_token` cookie (httpOnly, from backend)
- **Security:** No localStorage/JS cookies — pure backend-managed auth

---

## 3. ROOT LAYOUT & METADATA

### src/app/layout.tsx
- Uses Inter font (Google Fonts, Latin + Cyrillic)
- **Metadata:**
  - metadataBase: https://hostingvibe.ru
  - title: "VibeHosting — Твой сайт в интернете за 5 минут"
  - description + 8 keywords (Russian-only)
  - OpenGraph (og:type = website, locale = ru_RU)
  - robots: { index: true, follow: true }
- **Structured data:** WebApplication JSON-LD
- **Components:**
  - YandexMetrika (analytics, 107147478 counter ID)
  - CookieConsentBanner
  - Custom script tag for LD+JSON schema

---

## 4. API CLIENT & AUTH

### src/lib/api.ts (~662 lines)

**Core ApiClient class:**
- Base URL: `NEXT_PUBLIC_API_URL || '/api'`
- Credentials: `credentials: 'include'` (sends httpOnly cookie)
- Headers: Auto-set `Content-Type: application/json` (skip for FormData)
- **Auto-logout on 401:** Clears legacy tokens, redirects to `/login` (except on auth pages)

**Auth Endpoints:**
- `register(email, password, displayName?)` → { token, user }
- `login(email, password)` → { token, user }
- `getMe()` → User
- `forgotPassword(email)` → { message }
- `resetPassword(token, password)` → { message }
- `logout()` → void

**Project Management:**
- `getProjects()` → Project[]
- `createProject(title, slug)` → Project
- `getProject(id)` → Project & { deployments?, domains? }
- `updateProject(id, data)` → Project
- `deleteProject(id)` → void

**Deployment:**
- `deploy(projectId, file)` → { deploymentId, version, status, message }
- `deployGithub(projectId, repoUrl, subdir?)` → { message, status, deploymentId? }
- `getDeployments(projectId)` → Deployment[]
- `streamDeployStatus(projectId, deploymentId, onStatus, onDone?)` → cleanup function
  - Uses **EventSource** with `withCredentials: true`
  - Closes on LIVE, FAILED, or SUPERSEDED
- `rollback(projectId, version)` → { message, version }
- `getVersions(projectId)` → { versions: Version[], maxVersions, plan }

**Files:**
- `getProjectFiles(projectId, dirPath?)` → { path, files: FileEntry[], total }

**Visual Editor (Patches):**
- `getEditPages(projectId)` → { pages: { path, size, modified }[] }
- `getEditPatches(projectId)` → { patches: VisualPatch[] }
- `createEditPatch(projectId, data)` → { patch: VisualPatch }
- `updateEditPatch(projectId, patchId, data)` → { patch: VisualPatch }
- `deleteEditPatch(projectId, patchId)` → { success: boolean }
- `uploadEditAsset(projectId, file)` → { src, name, type }
- `getEditAssets(projectId)` → { assets: { src, name, type }[] }
- `getEditPreviewUrl(projectId, pagePath?, slug?)` → URL
  - Uses subdomain format: `https://{slug}.hostingvibe.ru/__vibe_preview?path=...`
  - Falls back to `/api/internal/preview?path=...`

**Gallery:**
- `getGallery(params?)` → GalleryResponse
- `getGalleryTags()` → GalleryTag[]
- `toggleLike(slug)` → { liked, likes }

**Domains:**
- `getDomains()` → Domain[]
- `addDomain(hostname, projectId)` → Domain & { instructions: DnsInstructions }
- `verifyDomain(id)` → { verified, sslStatus?, message }
- `deleteDomain(id)` → { success }

**Billing:**
- `getBillingStatus()` → BillingStatus
- `createPayment(autoRenew?)` → { paymentUrl }
- `createAiPack(pack: '10' | '50')` → { paymentUrl }
- `cancelSubscription()` → { success, message, currentPeriodEnd }

**Admin:**
- `getAdminStats()` → AdminStats
- `getAdminUsers(params?)` → { users: AdminUser[], pagination }
- `getAdminProjects(params?)` → { projects: AdminProject[], pagination }
- `suspendProject(id)` → { status }
- `getAdminReports(params?)` → { reports: AdminReport[], pagination }
- `updateReportStatus(id, status)` → AdminReport

**Other:**
- `changePassword(currentPassword, newPassword)` → { message }
- `updateProfile(data)` → User
- `deleteAccount(password)` → { message }
- `checkSlug(slug)` → { available, error? }
- `reportProject(slug, reason, message?)` → { success, message }
- `getTelegramStatus()` → TelegramStatus
- `generateTelegramLink()` → { deepLink, linkCode }
- `unlinkTelegram()` → { success, message }
- `getFormSubmissions(page?)` → FormSubmissionsResponse
- `getProjectAnalytics(projectId, days?)` → AnalyticsSummary

**Types:** 40+ exported types (User, Project, Deployment, VisualPatch, Domain, etc.)

### src/lib/auth.tsx (~66 lines)
**AuthContext + useAuth hook:**
- State: user (User | null), loading
- Methods: login, register, logout, refresh
- **refresh():** Calls api.getMe() → maintains auth state
- **On 401/403:** Auto-logs out (clears user)
- **On network error:** Keeps existing user state, retries on next nav

**Usage:**
```tsx
<AuthProvider>
  <App />
</AuthProvider>

const { user, loading, login, register, logout, refresh } = useAuth();
```

---

## 5. UTILITIES

### src/lib/utils.ts
- `pluralize(n, one, few, many)` — Russian pluralization (1, 2-4, 5+)
- `formatBytes(bytes)` — Converts to Б/КБ/МБ/ГБ
- `timeAgo(date)` — Relative time (Russian: "только что", "5 мин назад", etc.)

### src/lib/toast.ts (~28 lines)
**Lightweight event-based toast system:**
- `showToast(message, type)` — type: 'error' | 'success' | 'info'
- `onToast(fn)` — Subscribe to toasts, returns unsubscribe
- No external deps, just a Set of listeners

### src/lib/consent.ts
- `getStoredCookieConsent()` → 'accepted' | 'rejected' | null
- `setStoredCookieConsent(value)` → void
- Storage key: 'vh_cookie_consent' (localStorage)

### src/lib/ai-prompt.ts (~150 lines)
**Full AI assistant instructions for /ai page and /llms.txt**
- What VibeHosting is (static hosting only)
- Upload methods (ZIP, source code, GitHub)
- Restrictions (5000 files max, 50MB FREE / 500MB PRO)
- Full API flow (register → create project → deploy → check status)
- Deployment limits & common errors

### src/lib/useAnimate.ts
- Custom React hook for scroll-triggered animations with anime.js
- `useScrollReveal()` — Animate element on scroll
- `useStaggerReveal()` — Stagger animate children

---

## 6. LANDING PAGE (src/app/page.tsx)

**Layout:**
```
Header
  ↓
Hero (drag-drop, subdomain input)
  ↓
SocialProof
Supports
Showcase
HowItWorks
Features (12 feature cards + more grid)
UseCases
Stats
Testimonials
Comparison (vs Unlocal)
TrustSignals
Pricing (FREE / PRO 2-column)
FAQ
CTA
  ↓
Footer
```

**Component Breakdown:**

| Component | Lines | Purpose |
|-----------|-------|---------|
| Hero.tsx | 210 | Drag-drop hero, file type tabs, registration flow |
| SocialProof.tsx | 33 | Social badges ("Trusted by...") |
| Supports.tsx | 62 | Supported file types (.html, .zip, etc.) |
| Showcase.tsx | 206 | Code editor preview, example projects |
| HowItWorks.tsx | 68 | 3-step flow (upload → customize → deploy) |
| Features.tsx | 125 | 4 main features + 8 secondary features grid |
| UseCases.tsx | 144 | Use cases (portfolio, landing, resume, etc.) |
| Stats.tsx | 31 | Metrics (users, deploys, storage) |
| Testimonials.tsx | 88 | Social proof quotes |
| Comparison.tsx | 70 | Feature comparison vs competitors |
| TrustSignals.tsx | 61 | Security/compliance badges |
| Pricing.tsx | 121 | 2 tiers (FREE vs PRO) with feature lists |
| FAQ.tsx | 144 | ~10 Q&A items |
| CTA.tsx | 34 | Final call-to-action button |
| Footer.tsx | 81 | Links, copyright, social icons |
| Header.tsx | 111 | Top nav (Home, Gallery, Docs, Auth buttons) |

**Key Landing Features:**
- Scroll-triggered animations via anime.js
- Emerald/green accent throughout
- Russian-only copy (no i18n)
- CTA buttons link to `/register` with optional slug param
- Responsive grid layouts (md:grid-cols-2, etc.)

---

## 7. AUTHENTICATION PAGES

### src/app/(auth)/login/page.tsx (~189 lines)
- Email + password form
- "Show/hide password" toggle
- "Forgot password" link → `/forgot-password`
- "No account?" → `/register`
- **Validation:** Email regex, password required
- **Redirect on success:** Uses `from` query param or `/projects`
- **Unsafe redirect prevention:** Only allows relative paths, not open redirects
- **Animation:** anime.js entrance animation

### src/app/(auth)/register/page.tsx
- Similar to login, plus displayName field
- `?slug=...` & `?plan=...` query params (from landing)

### src/app/(auth)/forgot-password/page.tsx
- Email input
- Calls `/auth/forgot-password` endpoint

### src/app/(auth)/reset-password/page.tsx
- Token from URL, new password input
- Calls `/auth/reset-password` endpoint

### src/app/(auth)/layout.tsx
- Wraps all auth pages
- Centered, simple auth card design
- No dashboard nav

---

## 8. DASHBOARD LAYOUT & PAGES

### src/app/(dashboard)/layout.tsx (~143 lines)
**Shell Component (DashboardShell):**
- Top navbar with VibeHosting logo + Beta badge
- Nav links: Projects, Domains, Billing, Settings, Admin (if isAdmin)
- Plan badge (FREE/PRO)
- Storage bar (% usage)
- Logout button
- **Auth check:** If no user & !loading → redirects to `/login`
- Wraps children with AuthProvider, ErrorBoundary, ToastContainer

### src/app/(dashboard)/projects/page.tsx (~150+ lines)
- Lists user's projects (1 for FREE, 3 for PRO)
- **Status labels:** LIVE, PROCESSING, UPLOADING, ERROR, SUSPENDED
- Card animations via anime.js (staggered)
- **Actions per project:**
  - View/edit (link to `/projects/:id`)
  - Edit (link to `/projects/:id/edit`)
  - Public toggle
  - Copy URL
  - Export
  - Delete
  - QR code (download PNG)
  - Password toggle
  - Metrika settings
- **OnboardingModal:** Shows on `/projects?welcome=1` with slug & plan params
- **Create project button:** Links to `/projects/new`

### src/app/(dashboard)/projects/new/page.tsx
- Create new project form
- Slug validation (alphanumeric + hyphens, 3-63 chars)
- Title input
- Supports URL params: `?slug=...&plan=...` (prefill)

### src/app/(dashboard)/projects/[id]/page.tsx
- Project details + file browser
- Deploy uploader (ZIP drag-drop)
- Deployment history
- Version history with rollback

### src/app/(dashboard)/projects/[id]/edit/page.tsx
- Loads VibeEditor component (main visual editor interface)

### src/app/(dashboard)/projects/[id]/analytics/page.tsx
- Analytics dashboard
- Views, top pages, referrers, daily chart

### src/app/(dashboard)/billing/page.tsx (~200+ lines)
**Billing status & payment:**
- Displays: plan, AI credits, subscription status
- **Subscription states:**
  - INACTIVE (no sub)
  - ACTIVE (current)
  - PAST_DUE (3-day grace period)
  - CANCELLED (end date shown)
- **Actions:**
  - Upgrade to PRO → Prodamus payment gateway
  - Buy AI pack (10 or 50 credits)
  - Cancel subscription (with confirmation)
  - Auto-renewal toggle
- **Feature comparison:** FREE vs PRO side-by-side
- **Yandex.Metrika goal:** 'buy_pro_click' on upgrade click

### src/app/(dashboard)/domains/page.tsx (~300+ lines)
- List connected domains
- Add domain modal (hostname + project select)
- **Per domain:**
  - DNS setup instructions (REG.RU, Timeweb, Beget, Cloudflare)
  - Verify button
  - Copy DNS records
  - Delete
  - SSL status badge
- **Registrar guides:** Step-by-step (A, CNAME, TXT records)
- Server IP: 203.0.113.10

### src/app/(dashboard)/settings/page.tsx
- Profile: displayName, phone, email
- Change password
- Delete account (confirmation)
- Export user data

---

## 9. ADMIN PAGES

### src/app/(admin)/layout.tsx
- Dark theme (bg-gray-900, text-white)
- Admin nav sidebar
- Requires `user.isAdmin` flag

### src/app/(admin)/admin/page.tsx (~80 lines)
- **Stats cards:**
  - Users (total + PRO + weekly new)
  - PRO conversion %
  - Projects (total + LIVE)
  - Deploys (weekly)
  - Storage (bytes + MB)
- Dark card design (bg-gray-800)
- Color-coded icons per stat

### src/app/(admin)/admin/users/page.tsx
- Paginated user list
- Search by email/name
- Sort, filter

### src/app/(admin)/admin/projects/page.tsx
- Paginated project list
- Suspend project action
- View stats per project

### src/app/(admin)/admin/reports/page.tsx
- Moderation: reported projects
- Status: PENDING, REVIEWED, RESOLVED, DISMISSED
- Mark as reviewed/resolved

---

## 10. VISUAL EDITOR

### src/components/editor/VibeEditor.tsx (~713 lines)
**Main editor interface:**

**State:**
- Pages (file browser)
- Current page path
- Patches (text, image, hide, style)
- Selected element (selector, tag, text, src, computed styles)
- Active patch tab (text/image/hide/style)
- Bridge ready (iframe communication)
- Redo stack
- Style cache (selector → original computed styles)

**Features:**
- **Element selection:** Click on page elements, iframe → bridge postMessage
- **Patch types:**
  1. **text** — Change innerHTML (text nodes)
  2. **image** — Change src attr
  3. **hide** — display: none (toggle)
  4. **style** — Apply CSS properties (color, fontSize, fontWeight, textAlign, backgroundColor, lineHeight, letterSpacing, opacity, border, borderRadius, padding, margin, width, height)
- **Redo/Undo:** Ctrl+Y / Cmd+Shift+Z, separate redo stack
- **Asset upload:** Upload images for patches
- **Page switcher:** Dropdown to select index.html or other HTML files
- **Preview:** Opens iframe with `__vibe_preview` path
- **Sidebar:** Toggle (PanelRight icon)

**Bridge Communication:**
- Iframe loads from `getEditPreviewUrl()`
- postMessage protocol (vibe-editor-bridge.js):
  - `selectElement(selector, tag, elementType, text, src, computedStyles)`
  - `applyPatch(selector, type, content)`
  - `deselect()`

### src/components/editor/StyleEditor.tsx (~187 lines)
**Inline style editor (child of VibeEditor):**

**Controls:**
- **Color:** Hex input
- **Font Size:** Range slider (10-72px)
- **Font Weight:** Dropdown (400-800)
- **Text Align:** Buttons (left/center/right)
- **Line Height:** Range (1-2.5)
- **Letter Spacing:** Range (-2 to 2px)
- **Opacity:** Range (0-1)
- **Border:** Color + width inputs
- **Border Radius:** Range (0-50px)
- **Padding:** 4 directional inputs (px)
- **Margin:** 4 directional inputs (px)
- **Width/Height:** % inputs
- **Background Color:** Hex input

---

## 11. SHARED COMPONENTS

### src/components/landing/Header.tsx (~111 lines)
- Sticky nav bar (top-0 z-40)
- Logo + branding
- Links: Home, Gallery, Docs, Pricing, Contact, Auth buttons
- Responsive hamburger menu (mobile)

### src/components/ToastContainer.tsx (~59 lines)
- Renders toast notifications in top-right corner
- Listens to toast events (onToast hook)
- Auto-dismiss after 4s
- Color by type (red for error, green for success, blue for info)

### src/components/ErrorBoundary.tsx (~60 lines)
- Catches React errors
- Fallback UI with error message
- "Try again" button (reset)

### src/components/onboarding-modal.tsx (~231 lines)
- Congratulations modal on first sign-up
- Shows project slug + plan info
- "Go to projects" button
- Confetti animation (optional)

### src/components/cookies/CookieConsentBanner.tsx
- Consent banner (bottom of page)
- Accept/Reject buttons
- Stores consent in localStorage (`vh_cookie_consent`)
- Only shows if not previously set

### src/components/analytics/YandexMetrika.tsx
- Embeds Yandex.Metrika script
- Counter ID: 107147478
- Supports goals via `window.ym('reachGoal', 'goal_name')`

---

## 12. FILE STRUCTURE SUMMARY

```
frontend/
├── public/
│   ├── favicon.svg, favicon-*.png, favicon.ico
│   ├── apple-touch-icon.png
│   ├── android-chrome-*.png
│   └── site.webmanifest
├── src/
│   ├── app/
│   │   ├── (admin)/
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── projects/page.tsx
│   │   │   │   ├── users/page.tsx
│   │   │   │   └── reports/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── billing/page.tsx
│   │   │   ├── billing/success/page.tsx
│   │   │   ├── domains/page.tsx
│   │   │   ├── projects/[id]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── edit/page.tsx
│   │   │   │   ├── analytics/page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── DangerZone.tsx
│   │   │   │       ├── DeploymentHistory.tsx
│   │   │   │       ├── DeployUploader.tsx
│   │   │   │       ├── FileNavigator.tsx
│   │   │   │       ├── ProjectHeader.tsx
│   │   │   │       ├── ProjectSettings.tsx
│   │   │   │       ├── VersionHistory.tsx
│   │   │   │       └── shared.ts
│   │   │   ├── projects/new/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (legal)/
│   │   │   ├── offer/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   └── layout.tsx
│   │   ├── ai/
│   │   │   ├── AiPageContent.tsx
│   │   │   └── page.tsx
│   │   ├── gallery/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── docs/page.tsx
│   │   ├── llms.txt/route.ts
│   │   ├── not-found.tsx
│   │   ├── opengraph-image.tsx
│   │   ├── page.tsx (landing)
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   ├── layout.tsx (root)
│   │   └── globals.css
│   ├── components/
│   │   ├── editor/
│   │   │   ├── VibeEditor.tsx (713 lines)
│   │   │   └── StyleEditor.tsx (187 lines)
│   │   ├── landing/
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── SocialProof.tsx
│   │   │   ├── Supports.tsx
│   │   │   ├── Showcase.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── UseCases.tsx
│   │   │   ├── Stats.tsx
│   │   │   ├── Testimonials.tsx
│   │   │   ├── Comparison.tsx
│   │   │   ├── TrustSignals.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── FAQ.tsx
│   │   │   ├── CTA.tsx
│   │   │   └── Footer.tsx
│   │   ├── analytics/YandexMetrika.tsx
│   │   ├── cookies/CookieConsentBanner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── onboarding-modal.tsx
│   │   └── ToastContainer.tsx
│   ├── lib/
│   │   ├── api.ts (662 lines)
│   │   ├── auth.tsx (66 lines)
│   │   ├── ai-prompt.ts (150 lines)
│   │   ├── consent.ts
│   │   ├── toast.ts (28 lines)
│   │   ├── utils.ts (30 lines)
│   │   └── useAnimate.ts
│   ├── types/
│   │   └── global.d.ts
│   └── middleware.ts (47 lines)
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config (not found, v4 uses PostCSS)
├── tsconfig.json
└── package.json
```

---

## 13. KEY ARCHITECTURE DECISIONS

### Authentication
- **httpOnly cookie** (vibe_token, 7-day expiry)
- **No localStorage** — backend manages all auth state
- **Auto-logout on 401** — frontend clears user, redirects to /login

### API Design
- **Base:** NEXT_PUBLIC_API_URL (defaults to /api)
- **Credentials:** Always sent via `credentials: 'include'`
- **No JWT in URL** — avoids referrer leakage
- **EventSource with credentials** — for deployment status streaming

### Styling
- **Tailwind CSS 4** (PostCSS-based, no config file)
- **Emerald/green accent** (emerald-500, emerald-600)
- **Responsive:** `md:`, `sm:`, `lg:` prefixes throughout
- **Dark mode:** Admin pages use bg-gray-900, text-white

### Animations
- **anime.js 4** with named exports (e.g., `animate()`)
- **Used in:** Landing page (scroll reveal, stagger), auth pages, projects list
- **Pattern:** `useScrollReveal()` & `useStaggerReveal()` custom hooks

### Editor Architecture
- **iframe sandbox** — separate context for preview
- **postMessage Bridge** — vibe-editor-bridge.js (~310 LOC, in backend repo)
- **Patch types:** text, image, hide, style (4 total)
- **Style cache:** Saves original computed styles for reset

### Routing
- **Next.js App Router** (not Pages)
- **Layout groups:** (auth), (dashboard), (admin), (legal)
- **Dynamic routes:** [id], [id]/edit, [id]/analytics
- **Middleware:** Protects routes, redirects based on auth state

---

## 14. DEPENDENCIES INSIGHTS

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| next | 16.1.6 | Framework | Turbopack for dev, React 19 compat |
| react | 19.2.4 | Core | Latest stable |
| typescript | 5.9.3 | Type safety | Strict mode recommended |
| tailwindcss | 4.2.1 | Styling | PostCSS-based, no config file needed |
| animejs | 4.3.6 | Animations | Named exports only (no default) |
| lucide-react | 0.575.0 | Icons | ~1000 icons, tree-shakeable |
| qrcode.react | 4.2.0 | QR codes | Simple React wrapper |

---

## 15. NOTABLE PATTERNS & CONVENTIONS

### API Fallback
```typescript
const response = await api.getProject(id);
// Handle both: response.project || response (for backward compat)
```

### useAuth Hook
```typescript
const { user, loading, login, register, logout, refresh } = useAuth();
// Always called within <AuthProvider>
```

### Toast Notifications
```typescript
import { showToast } from '@/lib/toast';
showToast('Error message', 'error');
showToast('Success!', 'success');
showToast('Info', 'info');
```

### Scroll-Triggered Animations
```typescript
const ref = useScrollReveal({ delay: 100 });
<div ref={ref}>Content</div> // Animates on scroll into view
```

### Form Validation
- Email: `/[^\s@]+@[^\s@]+\.[^\s@]+/`
- Slug: Alphanumeric + hyphens, 3-63 chars, no double hyphens, no leading/trailing hyphens

---

## 16. TOTALS & METRICS

| Metric | Value |
|--------|-------|
| Total component files | ~40 |
| Total component LOC | ~2,962 |
| Largest components | VibeEditor (713), onboarding-modal (231), domains (300+), billing (200+) |
| API methods | 50+ |
| Exported types | 40+ |
| Landing page sections | 15 |
| Admin pages | 4 |
| Dashboard pages | 6 |
| Auth pages | 4 |

---

## 17. ENTRY POINTS & FLOWS

### Landing (Public)
- `/` → page.tsx (15 component sections, Pricing, CTA)
- `/gallery` → Gallery page (project showcase, like/report)
- `/docs` → Documentation
- `/ai` → AI assistant instructions

### Auth (Public)
- `/login` → Email + password
- `/register` → Email + password + displayName
- `/forgot-password` → Email reset link
- `/reset-password?token=X` → New password

### Dashboard (Protected)
- `/projects` → Project list + create
- `/projects/new` → Create project form
- `/projects/:id` → Project details
- `/projects/:id/edit` → Visual editor (VibeEditor)
- `/projects/:id/analytics` → Analytics
- `/billing` → Pricing + payment
- `/domains` → Custom domains + DNS
- `/settings` → Profile + security

### Admin (Protected + isAdmin)
- `/admin` → Stats dashboard
- `/admin/users` → User list
- `/admin/projects` → Project list
- `/admin/reports` → Moderation

---

## 18. EXTERNAL INTEGRATIONS

1. **Yandex.Metrika** (107147478)
   - Auto-embedded in root layout
   - Goals: `buy_pro_click`

2. **Prodamus** (Payment Gateway)
   - `createPayment()` returns paymentUrl
   - `createAiPack()` returns paymentUrl

3. **Google Fonts**
   - Inter (Latin + Cyrillic)

4. **Lucide Icons**
   - 1000+ icons via `lucide-react`

---

## 19. SECURITY NOTES

- ✅ httpOnly cookies (no JS access)
- ✅ CSRF protection (implicit via httpOnly + SameSite)
- ✅ Open redirect prevention (in login page)
- ✅ Content-Type auto-set (except FormData)
- ✅ Error boundaries (catch React errors)
- ✅ Rate limiting (enforced backend, not frontend)
- ⚠️ CSP headers (enforced backend, Helmet)
- ⚠️ CORS (enforced backend, public cross-origin routes)

---

## 20. BUILD & DEPLOYMENT NOTES

- **Dev:** `npm run dev` (Turbopack, port 7002)
- **Build:** `npm run build` (Next.js static + Node.js runtime)
- **Start:** `npm start` (port 7002)
- **Environment:** `NEXT_PUBLIC_API_URL` (frontend can see this)
- **Deployment:** Next.js standalone mode recommended (PM2, systemd)

---

**End of Frontend Audit**
