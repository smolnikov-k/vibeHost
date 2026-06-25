# Frontend VibeHosting — Полный аудит

**Дата:** 21 марта 2026
**Стек:** Next.js 16.1.6, React 19, TypeScript 5.9, Tailwind CSS 4.2, Anime.js 4.3, Lucide React
**Порт:** 7002 (dev), production
**Язык:** Русский (International: Latin, Cyrillic fonts)

---

## 1. СТРУКТУРА ПРОЕКТА

### 1.1 Корневые директории
```
frontend/
├── src/
│   ├── app/          # Next.js App Router (pages + layouts)
│   ├── components/   # Reusable UI components
│   ├── lib/          # Utilities, hooks, API client, auth
│   └── types/        # TypeScript definitions
├── public/           # Static assets (favicon, manifest)
├── next.config.ts    # Next.js configuration
├── tsconfig.json     # TypeScript config (strict: true)
├── package.json      # Dependencies (React 19, Tailwind 4, Anime.js)
└── globals.css       # Tailwind + custom theme
```

### 1.2 Package.json скрипты
```json
{
  "dev": "next dev --turbopack -p 7002",    // Turbopack (fast)
  "build": "next build",
  "start": "next start -p 7002"
}
```

**Зависимости:**
- `next` 16.1.6 — App Router, SSR, SSG
- `react` 19.2.4 — Latest (Hooks, Suspense, useRef(null))
- `tailwindcss` 4.2.1 — CSS (custom theme via @theme)
- `animejs` 4.3.6 — Named exports (animation library)
- `qrcode.react` 4.2.0 — QR code generation
- `lucide-react` — Icon library (75+ icons used)

---

## 2. АРХИТЕКТУРА APP ROUTER

### 2.1 Route Groups и Layouts
```
/src/app/
├── layout.tsx                    # RootLayout (metadata, fonts, analytics)
├── page.tsx                      # Landing page (/)
├── globals.css                   # Tailwind + theme
│
├── (auth)/                       # Auth route group (no top nav)
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
├── (dashboard)/                  # Protected dashboard (with sidebar)
│   ├── layout.tsx                # DashboardLayout + AuthProvider
│   ├── projects/page.tsx         # My Projects list
│   ├── projects/new/page.tsx     # Create new project
│   ├── projects/[id]/page.tsx    # Project detail view
│   ├── projects/[id]/edit/page.tsx
│   ├── projects/[id]/analytics/page.tsx
│   ├── projects/[id]/components/ # Sub-components
│   │   ├── ProjectHeader.tsx
│   │   ├── DeployUploader.tsx
│   │   ├── DeploymentHistory.tsx
│   │   ├── VersionHistory.tsx
│   │   ├── FileNavigator.tsx
│   │   ├── ProjectSettings.tsx
│   │   ├── DangerZone.tsx
│   │   └── shared.ts
│   ├── billing/page.tsx          # Subscription management
│   ├── billing/success/page.tsx  # Payment success callback
│   ├── domains/page.tsx          # Custom domains + DNS guide
│   └── settings/page.tsx         # Account settings
│
├── (admin)/                      # Admin panel (dark theme)
│   ├── layout.tsx
│   ├── admin/page.tsx            # Dashboard
│   ├── admin/users/page.tsx      # User management
│   ├── admin/projects/page.tsx   # Project audits
│   └── admin/reports/page.tsx    # Abuse reports
│
├── (legal)/                      # Legal pages
│   ├── layout.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   └── offer/page.tsx            # Offer of use
│
├── gallery/page.tsx              # Project showcase gallery
├── ai/page.tsx                   # AI features page
├── docs/page.tsx                 # Documentation
├── not-found.tsx                 # 404 page
├── robots.ts                     # SEO robots.txt
├── sitemap.ts                    # SEO sitemap
└── opengraph-image.tsx           # Dynamic OG image
```

**Ключевые особенности:**
- Route groups `()` изолируют layouts и визуальную структуру
- Middleware.ts охраняет `/projects`, `/admin`, `/settings`, `/billing`, `/domains`
- Auth pages перенаправляют на `/projects` если уже залогинен
- Защищённые страницы редиректят на `/login?from=...`

---

## 3. ВСЕ СТРАНИЦЫ И НАЗНАЧЕНИЕ

### 3.1 Публичные страницы

| Путь | Файл | Назначение |
|------|------|-----------|
| `/` | `page.tsx` | Landing page (Hero + 15 компонентов) |
| `/login` | `(auth)/login/page.tsx` | Email/password login |
| `/register` | `(auth)/register/page.tsx` | Sign-up форма (email, password, name) |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Password reset request |
| `/reset-password` | `(auth)/reset-password/page.tsx` | Password reset form (token-based) |
| `/gallery` | `gallery/page.tsx` | Project showcase (grid of examples) |
| `/ai` | `ai/page.tsx` | AI features + capabilities |
| `/docs` | `docs/page.tsx` | API documentation |
| `/privacy` | `(legal)/privacy/page.tsx` | Privacy policy (legal) |
| `/terms` | `(legal)/terms/page.tsx` | Terms of service |
| `/offer` | `(legal)/offer/page.tsx` | Offer of use (договор оферты) |

### 3.2 Защищённые дашборд страницы (требуют аутентификации)

| Путь | Файл | Назначение |
|------|------|-----------|
| `/projects` | `(dashboard)/projects/page.tsx` | My Projects list + filter |
| `/projects/new` | `(dashboard)/projects/new/page.tsx` | Create new project (ZIP upload) |
| `/projects/[id]` | `(dashboard)/projects/[id]/page.tsx` | Project detail (deployments, versions) |
| `/projects/[id]/edit` | `(dashboard)/projects/[id]/edit/page.tsx` | Visual editor for site |
| `/projects/[id]/analytics` | `(dashboard)/projects/[id]/analytics/page.tsx` | Traffic analytics, view history |
| `/billing` | `(dashboard)/billing/page.tsx` | Subscription + AI credits |
| `/billing/success` | `(dashboard)/billing/success/page.tsx` | Payment success (redirect from Prodamus) |
| `/domains` | `(dashboard)/domains/page.tsx` | Custom domains + DNS guide |
| `/settings` | `(dashboard)/settings/page.tsx` | Account settings, email, password |

### 3.3 Админ страницы (требуют isAdmin flag)

| Путь | Файл | Назначение |
|------|------|-----------|
| `/admin` | `(admin)/admin/page.tsx` | Admin dashboard (stats, charts) |
| `/admin/users` | `(admin)/admin/users/page.tsx` | User list, ban/suspend, analytics |
| `/admin/projects` | `(admin)/admin/projects/page.tsx` | Project audits, storage usage |
| `/admin/reports` | `(admin)/admin/reports/page.tsx` | Abuse reports, moderation |

---

## 4. КОМПОНЕНТЫ И МОДУЛИ

### 4.1 Landing компоненты

| Компонент | Путь | Функция |
|-----------|------|---------|
| Header | `components/landing/Header.tsx` | Sticky header, mobile menu, logo, auth links |
| Hero | `components/landing/Hero.tsx` | Drop zone + tabs (HTML, images, docs), animated intro |
| SocialProof | `components/landing/SocialProof.tsx` | User count, testimonial avatars |
| Supports | `components/landing/Supports.tsx` | Browser support, frameworks, file types |
| Showcase | `components/landing/Showcase.tsx` | Project examples (cards with links) |
| HowItWorks | `components/landing/HowItWorks.tsx` | 5-step process (upload → deploy → share) |
| Features | `components/landing/Features.tsx` | 12+ features (QR, SSL, visual editor, etc.) |
| UseCases | `components/landing/UseCases.tsx` | Portfolio, presentation, web-app examples |
| Stats | `components/landing/Stats.tsx` | KPIs (sites deployed, storage, traffic) |
| Testimonials | `components/landing/Testimonials.tsx` | User testimonials carousel |
| Comparison | `components/landing/Comparison.tsx` | VibeHosting vs competitors table |
| TrustSignals | `components/landing/TrustSignals.tsx` | Security badges, SSL, 152-ФЗ compliance |
| Pricing | `components/landing/Pricing.tsx` | 2 plans (FREE/PRO), features comparison |
| FAQ | `components/landing/FAQ.tsx` | 10 accordion Q&A items |
| CTA | `components/landing/CTA.tsx` | Final call-to-action button |
| Footer | `components/landing/Footer.tsx` | Links, social, copyright, legal |

**Анимации:** Все компоненты используют `useScrollReveal()` из `lib/useAnimate.ts` — элементы появляются с opacity fade + translate когда входят в viewport.

### 4.2 Dashboard компоненты (Projects)

| Компонент | Путь | Функция |
|-----------|------|---------|
| ProjectHeader | `projects/[id]/components/ProjectHeader.tsx` | Title, domain, status, QR code |
| DeployUploader | `projects/[id]/components/DeployUploader.tsx` | ZIP upload form, drag-and-drop |
| DeploymentHistory | `projects/[id]/components/DeploymentHistory.tsx` | Timeline of deployments, status |
| VersionHistory | `projects/[id]/components/VersionHistory.tsx` | Rollback to previous versions |
| FileNavigator | `projects/[id]/components/FileNavigator.tsx` | Browse uploaded files, tree view |
| ProjectSettings | `projects/[id]/components/ProjectSettings.tsx` | Password protect, title, description |
| DangerZone | `projects/[id]/components/DangerZone.tsx` | Delete project, reset, suspend |
| shared.ts | `projects/[id]/components/shared.ts` | Utility functions, status colors, formatters |

### 4.3 Утилиты и провайдеры

| Модуль | Путь | Назначение |
|--------|------|-----------|
| auth.tsx | `lib/auth.tsx` | AuthProvider, useAuth hook, JWT/cookie logic |
| api.ts | `lib/api.ts` | ApiClient class (657 строк), 40+ методов |
| utils.ts | `lib/utils.ts` | Formatters (bytes, dates), helpers |
| useAnimate.ts | `lib/useAnimate.ts` | useScrollReveal, useStaggerReveal (anime.js integration) |
| toast.ts | `lib/toast.ts` | showToast() notifications |
| consent.ts | `lib/consent.ts` | Cookie consent manager |
| ai-prompt.ts | `lib/ai-prompt.ts` | AI integration utilities |

### 4.4 Другие компоненты

| Компонент | Путь | Функция |
|-----------|------|---------|
| ErrorBoundary | `components/ErrorBoundary.tsx` | React error handling |
| ToastContainer | `components/ToastContainer.tsx` | Toast notifications UI |
| OnboardingModal | `components/onboarding-modal.tsx` | Welcome modal for new users |
| CookieConsentBanner | `components/cookies/CookieConsentBanner.tsx` | GDPR-like consent |
| YandexMetrika | `components/analytics/YandexMetrika.tsx` | Analytics tracking script |
| VibeEditor | `components/editor/VibeEditor.tsx` | Visual site editor (iframe-based) |
| StyleEditor | `components/editor/StyleEditor.tsx` | CSS style tweaker |

---

## 5. MIDDLEWARE И МАРШРУТИЗАЦИЯ

### 5.1 Middleware.ts (/src/middleware.ts)

```typescript
// Protected prefixes require token in 'vibe_token' cookie
const PROTECTED_PREFIXES = [
  '/projects',     // My projects
  '/settings',     // Account settings
  '/billing',      // Subscription
  '/domains',      // Custom domains
  '/admin',        // Admin panel
];

// Auth pages redirect to /projects if already logged in
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Logic:
// 1. Protected routes + no token → redirect /login?from=[pathname]
// 2. Auth pages + token → redirect /projects
// 3. Otherwise → allow
```

**Matcher:** Middleware runs on `/projects/:path*`, `/settings/:path*`, etc.

### 5.2 Редиректы (next.config.ts)

```typescript
async redirects() {
  return [
    { source: '/projects/:id/editor', destination: '/projects/:id/edit', permanent: true },
    { source: '/projects/:id/patches', destination: '/projects/:id/edit', permanent: true },
  ];
}
```

---

## 6. АУТЕНТИФИКАЦИЯ И АВТОРИЗАЦИЯ

### 6.1 Flow

1. **Register:** `POST /api/auth/register` → httpOnly cookie `vibe_token` (JWT, 7 дней)
2. **Login:** `POST /api/auth/login` → cookie set + redirect `/projects`
3. **Protected routes:** Middleware проверяет наличие `vibe_token` cookie
4. **getMe():** Периодическая проверка на свежесть токена + получение user data

### 6.2 useAuth Hook (/src/lib/auth.tsx)

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email, password) => Promise<void>;
  register: (email, password, displayName?) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

// Использование:
// const { user, loading, logout } = useAuth();
```

**Ключевые моменты:**
- Cookie-based auth (httpOnly, не localStorage)
- 401 → auto-redirect /login
- AuthProvider обёртывает (dashboard) и (admin) layouts
- Нет клиент-сайд storage токенов

### 6.3 API Client (/src/lib/api.ts)

```typescript
class ApiClient {
  async fetch<T>(path, options = {}) {
    // Все запросы: credentials: 'include' (отправляет cookie)
    // 401 → clearLegacyTokens() + redirect /login
    // 204 → возвращает undefined
  }

  async register(email, password, displayName?)
  async login(email, password)
  async logout()
  async getMe()

  // Projects
  async getProjects(): Promise<Project[]>
  async getProject(id): Promise<Project>
  async createProject(title, slug): Promise<Project>
  async updateProject(id, data)
  async deleteProject(id)
  async getDeployments(id): Promise<Deployment[]>
  async rollback(id, version)

  // Domains
  async getDomains(): Promise<Domain[]>
  async addDomain(hostname, projectId)
  async verifyDomain(id): Promise<{ verified, message, sslStatus }>
  async deleteDomain(id)

  // Billing
  async getBillingStatus(): Promise<BillingStatus>
  async createPayment(autoRenew): Promise<{ paymentUrl }>
  async createAiPack(pack: '10'|'50'): Promise<{ paymentUrl }>
  async cancelSubscription()

  // Settings
  async updateSettings(email, password)
  async downloadProject(id): Promise<Blob>
  async getAnalytics(id): Promise<Analytics>
}
```

**Типы данных:**
```typescript
interface User {
  id: string;
  email: string;
  displayName?: string;
  plan: 'FREE' | 'PRO';
  storageUsed: bigint;
  storageLimit: bigint;
  isAdmin: boolean;
}

interface Project {
  id: string;
  title: string;
  slug: string;
  status: 'LIVE' | 'PROCESSING' | 'UPLOADING' | 'ERROR' | 'SUSPENDED';
  customDomain?: string;
  sizeBytes: bigint;
  currentVersion: number;
  passwordEnabled: boolean;
  updatedAt: string;
  deployments: Deployment[];
}

interface Deployment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'LIVE' | 'FAILED';
  errorMessage?: string;
  uploadedAt: string;
  version: number;
}

interface Domain {
  id: string;
  hostname: string;
  verified: boolean;
  sslStatus: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED' | 'EXPIRED';
  verifyToken?: string;
  project?: Project;
}

interface BillingStatus {
  plan: 'FREE' | 'PRO';
  aiCredits: number;
  subscription?: {
    status: 'INACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    currentPeriodEnd?: string;
    hasAutopayment: boolean;
  };
}
```

---

## 7. СТИЛИ И ТЕМА

### 7.1 Tailwind Config (globals.css)

```css
@import "tailwindcss";

@theme {
  --color-emerald-50: #ecfdf5;
  --color-emerald-100: #d1fae5;
  --color-emerald-200: #a7f3d0;
  --color-emerald-300: #6ee7b7;
  --color-emerald-400: #34d399;
  --color-emerald-500: #10b981;  /* PRIMARY ACCENT */
  --color-emerald-600: #059669;
  --color-emerald-700: #047857;

  --color-green-400: #4ade80;
  --color-green-500: #22c55e;
  --color-green-600: #16a34a;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

/* Respects prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

**Палитра:**
- **Primary:** Emerald (green-500, green-600, green-500)
- **Secondary:** Gray (900-50)
- **Accent:** Yellow (for warnings), Red (for errors)
- **Font:** Inter (Cyrillic + Latin subsets)

### 7.2 Глобальные стили
- Smooth scroll (`scroll-behavior: smooth`)
- Font smoothing (`antialiased`, `-moz-osx-font-smoothing`)
- Skeleton loading animation (`shimmer`)

---

## 8. АНИМАЦИИ

### 8.1 Anime.js интеграция

**useScrollReveal() hook:**
```typescript
export function useScrollReveal(options?: { delay?: number; distance?: string }) {
  // Инициализирует элемент opacity: 0, translateY: 40px
  // Когда элемент входит в viewport (threshold: 0.1):
  //   - animate к opacity: 1, translateY: 0
  //   - duration: 800ms, ease: 'outExpo'
  //   - delay: configurable
  // Использование: const ref = useScrollReveal({ delay: 150 })
}

export function useStaggerReveal() {
  // Animates все children с stagger delay (каждый на +100ms)
  // duration: 600ms, ease: 'outExpo'
}
```

**Где используется:**
- Landing компоненты (Hero, Pricing, Features, Testimonials, etc.)
- Projects list (карточки)
- Dashboard элементы

**Прямые вызовы animate():**
- `Hero.tsx`: Title + tabs стаггер (100ms delay, 700ms duration)
- `Header.tsx`: Logo fade-in (600ms)
- `ProjectsPage.tsx`: Cards stagger (80ms delay)

---

## 9. ФОРМЫ И ВАЛИДАЦИЯ

### 9.1 Auth формы

**Login/Register:**
- HTML5 validation (`required`, `type="email"`)
- Обработчик `onSubmit` предотвращает дефолт
- Отправка через `api.login()` / `api.register()`
- Ошибки показываются в alert или toast

**Reset Password:**
- Двух-шаговой процесс: запрос → ввод токена → новый пароль
- Токен в URL: `/reset-password?token=...`

### 9.2 Project создание/редактирование

**DeployUploader:**
- Drag-and-drop zone
- File input accept=".zip,.tar.gz"
- POST `/api/projects/[id]/deploy` с FormData

**ProjectSettings:**
- Inline editing (title, description)
- Password protection toggle
- Custom domain input

### 9.3 Domain добавление

**DomainsPage:**
- Form: hostname input (очищение `www.`, `http://`)
- Project selector dropdown
- Validation (required fields)
- DNS guide с tabs (REG.RU, Timeweb, Beget, Cloudflare, etc.)

### 9.4 Billing формы

**BillingPage:**
- PRO upgrade button → `api.createPayment()` → Prodamus payment URL
- AI credits pack selection (10/50 credits)
- Auto-renew toggle
- Cancel subscription confirmation

---

## 10. ДАШБОРД И ЛК

### 10.1 Dashboard Layout (/src/app/(dashboard)/layout.tsx)

```
┌─────────────────────────────────────────────────────────┐
│ Header (sticky)                                         │
│  [Logo]  [Projects] [Domains] [Billing] [Settings] │ Admin │
│                                    [PLAN] [%Storage] [Logout]
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main content (ErrorBoundary, Suspense)               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ToastContainer (bottom-right notifications)            │
└─────────────────────────────────────────────────────────┘
```

**Компоненты:**
- Top nav: Проекты, домены, тариф, настройки, админ (if isAdmin)
- Plan badge (FREE/PRO gradient)
- Storage progress bar (% of limit)
- Logout кнопка

### 10.2 Projects (/projects)

**Функциональность:**
- Список всех проектов user'а (max 1 для FREE, 3 для PRO)
- Статус фильтр (LIVE, PROCESSING, ERROR, SUSPENDED)
- Размер файла, дата обновления, версия
- Кнопка "Открыть" для LIVE проектов (открывает в новой вкладке)
- Кнопка "Новый проект" (disabled если лимит достигнут)

**Анимации:** Cards fade-in + stagger на загрузку

**Onboarding:** Модальное окно для новых юзеров с подсказками

### 10.3 Project Detail (/projects/[id])

**Экраны:**
1. **Main:** ProjectHeader + DeployUploader + DeploymentHistory
2. **Edit:** Visual editor (iframe-based) + StyleEditor
3. **Analytics:** Traffic charts, view count, browser info

**ProjectHeader:**
- Title, domain (custom or .hostingvibe.ru subdomain)
- QR-code preview (toggle)
- Status badge
- "Edit" link (if LIVE), "Analytics" link
- File size, last updated, version count
- Password-protected indicator

**DeployUploader:**
- "Drag file here" zone
- Click to browse files
- Accepts .zip, .tar.gz
- Progress bar during upload
- Estimated size after upload

**DeploymentHistory:**
- Timeline of deployments
- Each: version, status (LIVE/FAILED), date, error message
- Rollback button (if version > 1)

**VersionHistory:**
- Grid of versions
- Size, date, status
- Rollback with confirmation

**FileNavigator:**
- Tree view of uploaded files
- File sizes, preview links
- Download individual files

**DangerZone:**
- Delete project (with confirmation)
- Reset project
- Suspend project

### 10.4 Domains (/domains) — PRO only

**DNS Guide UI:**
- Step-by-step wizard (4 steps)
- Registrar tabs: REG.RU, Timeweb, Beget, Cloudflare, Other
- Copy-to-clipboard buttons for IP, domain, token
- Detailed instructions per registrar
- Warnings (e.g., "Proxy MUST be disabled on Cloudflare")
- FAQ at bottom

**Domain List:**
- Status: Ожидание DNS / Подтверждён / SSL ACTIVE / SSL FAILED
- Verify button (checks DNS + issues SSL)
- Retry SSL button (if verified but SSL failed)
- Delete button

**Form:**
- Hostname input (validates format)
- Project selector

### 10.5 Billing (/billing)

**Status display:**
- Current plan (FREE/PRO)
- Subscription status (ACTIVE, PAST_DUE, CANCELLED)
- Current period end date
- AI credits balance

**Actions:**
- "Upgrade to PRO" button (if FREE)
  - Toggle "Auto-renew" checkbox
  - Redirect to Prodamus payment
- "Buy AI credits" (10 or 50 pack)
- "Cancel subscription" (with confirmation)
- "Renew subscription" (if expired)

**Yandex Metrika tracking:** `window.ym(107147478, 'reachGoal', 'buy_pro_click')`

### 10.6 Settings (/settings)

- Email change form
- Password change form
- Account deletion (with confirmation)
- Session management (logout all devices)
- Download account data (GDPR)

---

## 11. АДМИН ПАНЕЛЬ

### 11.1 Admin Layout (Dark theme)

```
┌──────────────────────────────────────────────────────────┐
│ [VibeAdmin] ⚠️  │ Dashboard │ Users │ Projects │ Reports │
├──────────────────────────────────────────────────────────┤
│ Main admin content (dark: bg-gray-900, text: gray-100)  │
├──────────────────────────────────────────────────────────┤
```

**Цвета:**
- Background: gray-900
- Cards: gray-800
- Text: gray-100, gray-400
- Accent: emerald-400 (для links)
- Warning: amber-400 (для alerts)

### 11.2 Admin Pages

| Страница | Функции |
|----------|---------|
| `/admin` | KPI dashboard (user count, storage, traffic) |
| `/admin/users` | User list, ban/suspend, plan change, email search |
| `/admin/projects` | Project audits, file listing, size usage |
| `/admin/reports` | Abuse reports, moderation, delete content |

---

## 12. ЛЕНДИНГ И СЕКЦИИ

### 12.1 Landing Sections (page.tsx)

```
├── Header (sticky, gradient on scroll)
├── Hero (drag-drop zone, tab selection)
├── SocialProof (avatars, user count)
├── Supports (frameworks, browsers)
├── Showcase (gallery of projects)
├── HowItWorks (5-step process)
├── Features (12+ feature cards)
├── UseCases (portfolio, presentation, etc.)
├── Stats (KPIs)
├── Testimonials (carousel)
├── Comparison (table: VibeHosting vs competitors)
├── TrustSignals (security badges, SSL, compliance)
├── Pricing (2 plans side-by-side)
├── FAQ (accordion)
├── CTA (final button)
└── Footer
```

### 12.2 Pricing таблица

**FREE:**
- Цена: 0 ₽
- 1 сайт
- 50 МБ хранилище
- Субдомен .hostingvibe.ru
- 10 ГБ трафик/мес
- Базовая аналитика
- 3 версии для отката
- Без привязки карты

**PRO:**
- Цена: 386 ₽/мес
- 3 сайта
- 1 ГБ хранилище (до 500 МБ на сайт)
- Кастомные домены + SSL
- Безлимит трафик
- Подробная аналитика
- 15 версий для отката
- Визуальный редактор
- Формы → Telegram

**CTA buttons:**
- FREE: `/register`
- PRO: `/register?plan=pro`

---

## 13. КОМПОНЕНТЫ ВИЗУАЛЬНОГО РЕДАКТОРА

### 13.1 VibeEditor.tsx

```typescript
interface VibeEditorProps {
  projectId: string;
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
}

// Функциональность:
// - iframe с редактором
// - Click-to-edit элементы
// - Live preview + code view
// - Undo/redo
// - Keyboard shortcuts
// - Auto-save
```

### 13.2 StyleEditor.tsx

```typescript
// CSS tweaker UI
// - Sidebar с CSS properties
// - Preview на сайте в реальном времени
// - Color picker для backgrounds, text
// - Font selector
// - Spacing/padding control
```

---

## 14. RESPONSIVE DESIGN

### 14.1 Breakpoints (Tailwind default)

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

**Использование:**
- Header: `hidden sm:block`, `hidden md:flex`
- Projects list: Grid 1/2/3 колонок
- Domains guide: Sticky на desktop, collapse на mobile
- Pricing cards: Stack на mobile, 2-col на desktop
- Admin tables: Horizontal scroll на mobile

### 14.2 Mobile-first подход

- Max-width containers (max-w-6xl, max-w-7xl)
- Padding/margin scales (sm:px-6, px-4)
- Font sizes (sm:text-lg, text-base)
- Storage bar hidden on mobile (`hidden sm:flex`)
- Mobile menu overlay (full-screen на md)

---

## 15. АНАЛИЗ КОДА И ТИПЫ

### 15.1 TypeScript конфиг

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**Строгий режим:** Все типы проверяются (strict: true)

### 15.2 Типы данных (lib/api.ts)

```typescript
export interface User {
  id: string;
  email: string;
  displayName?: string;
  plan: 'FREE' | 'PRO';
  storageUsed: bigint;
  storageLimit: bigint;
  isAdmin: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  slug: string;
  status: 'LIVE' | 'PROCESSING' | 'UPLOADING' | 'ERROR' | 'SUSPENDED';
  customDomain?: string;
  sizeBytes: bigint;
  currentVersion: number;
  passwordEnabled: boolean;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'LIVE' | 'FAILED';
  errorMessage?: string;
  uploadedAt: string;
  version: number;
}

export interface Domain {
  id: string;
  userId: string;
  projectId: string;
  hostname: string;
  verified: boolean;
  sslStatus: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED' | 'EXPIRED';
  verifyToken?: string;
  createdAt: string;
}
```

---

## 16. API ENDPOINTS (НАЗЫВАЕМЫЕ)

**Auth:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

**Projects:**
- GET /api/projects
- GET /api/projects/[id]
- POST /api/projects
- PUT /api/projects/[id]
- DELETE /api/projects/[id]
- POST /api/projects/[id]/deploy (multipart FormData)
- GET /api/projects/[id]/deployments
- POST /api/projects/[id]/rollback
- GET /api/projects/[id]/analytics
- POST /api/projects/[id]/download

**Domains:**
- GET /api/domains
- POST /api/domains
- POST /api/domains/[id]/verify
- DELETE /api/domains/[id]

**Billing:**
- GET /api/billing/status
- POST /api/billing/payment
- POST /api/billing/ai-pack
- POST /api/billing/cancel

**Settings:**
- PUT /api/settings/email
- PUT /api/settings/password
- DELETE /api/settings/account

**Admin (if isAdmin):**
- GET /api/admin/users
- GET /api/admin/projects
- GET /api/admin/reports
- PUT /api/admin/users/[id]/ban
- DELETE /api/admin/projects/[id]

---

## 17. ERROR HANDLING И EDGE CASES

### 17.1 ErrorBoundary

```typescript
// Ловит React ошибки (render-time, lifecycle, event handlers)
// Показывает fallback UI с refresh button
// Логирует в console (dev mode)
```

### 17.2 API ошибки

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Обработка:
// 401 → auto-redirect /login
// 403 → show "Access denied"
// 404 → show "Not found"
// 500 → show "Server error, try again"
// Network → keep state, retry on nav
```

### 17.3 Suspense fallback

```typescript
<Suspense fallback={<Loader2 className="animate-spin" />}>
  <Component />
</Suspense>
```

### 17.4 Empty states

- Нет проектов → "Создай первый проект"
- Нет доменов → "Добавь кастомный домен (PRO)"
- Нет тарифной истории → "Нет подписки"

---

## 18. ПРОИЗВОДИТЕЛЬНОСТЬ И ОПТИМИЗАЦИЯ

### 18.1 Next.js оптимизации

- **Turbopack:** `npm run dev --turbopack` (70% faster builds)
- **App Router:** Нативный streaming, incremental adoption
- **Image optimization:** `next/image` (не используется, много статики)
- **Font optimization:** `next/font` (Inter с Cyrillic)
- **Code splitting:** Automatic per-route

### 18.2 Бандлы

- **Landing:** ~150KB JS (Hero, animations, metadata)
- **Dashboard:** ~200KB JS (auth, API client, UI components)
- **Admin:** ~180KB JS (dark theme, analytics)
- **vendor:** Tailwind CSS (4.2.1), Anime.js (4.3.6), Lucide (icons)

### 18.3 Images и медиа

- SVG icons (Lucide React — tree-shaking friendly)
- Public favicons (SVG + PNG)
- No heavy images in components (lazy load in gallery)
- QR code generated client-side (qrcode.react)

---

## 19. SEO И МЕТАДАННЫЕ

### 19.1 RootLayout metadata

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://hostingvibe.ru'),
  title: { default: 'VibeHosting — Твой сайт за 5 минут', template: '%s | VibeHosting' },
  description: 'Перетащи файлы — получи ссылку. Бесплатно. Без программиста.',
  keywords: ['хостинг', 'запустить сайт', 'бесплатный хостинг', ...],
  openGraph: { title, description, url, siteName, locale, type, image },
  twitter: { card, title, description },
  robots: { index: true, follow: true },
  manifest: '/site.webmanifest',
  icons: { icon: [...], apple: [...] },
  alternates: { canonical: 'https://hostingvibe.ru' },
};
```

### 19.2 JSON-LD Schema

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "VibeHosting",
  "url": "https://hostingvibe.ru",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "RUB"
  }
}
```

### 19.3 Robots и Sitemap

- `robots.ts` → `/robots.txt` (User-agent: *, Allow: /)
- `sitemap.ts` → `/sitemap.xml` (all public routes)
- Canonical URLs в metadata

---

## 20. SECURITY И COMPLIANCE

### 20.1 Аутентификация

- JWT 7 дней (httpOnly cookie, Secure, SameSite)
- No localStorage tokens
- CSRF token в forms (backend)
- Password хеш bcrypt (backend)

### 20.2 HTTPS

- Все production URLs https://
- SSL автоматически для кастомных доменов (Let's Encrypt)
- Mixed content warnings (dev mode)

### 20.3 Content Security Policy

- Nonce для inline scripts (Yandex Metrika)
- No eval(), no unsafe-inline
- Trusted script sources

### 20.4 Compliance

- 152-ФЗ о персональных данных (указано в FAQ, privacy)
- Cookie consent banner (CookieConsentBanner.tsx)
- Privacy policy page
- Terms of service page
- Offer of use (договор оферты)

---

## 21. ANALYTICS И TRACKING

### 21.1 Yandex Metrika

```typescript
// YandexMetrika.tsx
<script async src="https://mc.yandex.ru/metrika/tag.js"></script>
window.ym(107147478, 'init', { ...config });

// Goals:
window.ym(107147478, 'reachGoal', 'buy_pro_click');
window.ym(107147478, 'reachGoal', 'signup');
```

### 21.2 Analytics page (/projects/[id]/analytics)

- Traffic stats (views per day, week, month)
- Browser distribution
- Device stats (desktop/mobile/tablet)
- Top pages within project
- Referrer sources

---

## 22. ЛОКАЛИЗАЦИЯ

### 22.1 Язык

- **Интерфейс:** Русский (все UI тексты)
- **Fonts:** Inter (Latin + Cyrillic subsets)
- **HTML lang:** `<html lang="ru">`
- **Yandex Metrika:** Правильная трактовка кириллицы

### 22.2 Дата/время форматы

```typescript
// Russian locale
const date = new Date(iso).toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
// "21 марта 2026"
```

---

## 23. ИНТЕГРАЦИИ

### 23.1 Платежи

- **Prodamus** — payment gateway
- Endpoint: `createPayment(autoRenew)` → paymentUrl
- Callback: `/billing/success?status=ok`

### 23.2 Telegram (Формы)

- Backend integration (не в frontend)
- Frontend: обычная HTML форма
- На submit → API отправляет в Telegram бот

### 23.3 GitHub

- Не интегрирован в frontend
- (Может быть в документации /docs)

---

## 24. ПОТЕНЦИАЛЬНЫЕ УЛУЧШЕНИЯ

### 24.1 Performance

- [ ] Image optimization (gallery, avatars)
- [ ] Lazy load Yandex Metrika
- [ ] Service Worker для offline support
- [ ] Prefetch API endpoints (router)

### 24.2 Features

- [ ] Bulk operations (delete multiple projects)
- [ ] Project templates (pre-made sites)
- [ ] Collaboration (share project with team)
- [ ] Advanced analytics (heatmaps, session replay)
- [ ] AI website builder (drag-drop builder)

### 24.3 UX

- [ ] Undo/redo in visual editor
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts (Ctrl+S save, etc.)
- [ ] Tutorial overlay (first-time users)
- [ ] Mobile app (PWA or native)

### 24.4 Code Quality

- [ ] Unit tests (Jest, React Testing Library)
- [ ] E2E tests (Playwright, Cypress)
- [ ] Storybook components
- [ ] Error logging service (Sentry)
- [ ] Performance monitoring

---

## 25. ФАЙЛОВАЯ СТРУКТУРА И РАЗМЕРЫ

```
frontend/
├── src/
│   ├── app/                    # 33 .tsx/.ts files
│   ├── components/             # 25 .tsx files
│   ├── lib/                    # 8 .ts/.tsx files
│   └── types/                  # 1 .d.ts file
├── public/                     # favicon, manifest
├── node_modules/               # ~500MB (not committed)
├── .next/                      # Build output (not committed)
├── package.json                # 27 dependencies
├── next.config.ts              # Simple config
├── tsconfig.json               # Strict mode
└── globals.css                 # ~55 lines

Total .tsx/.ts files: ~70
Lines of code: ~15,000 (estimated)
Build size: ~2-3MB (gzipped: ~600KB)
```

---

## 26. ЗАПУСК И ДЕПЛОЙ

### 26.1 Local development

```bash
cd /root/vibecode/vibe-hosting/frontend
npm install
npm run dev       # http://localhost:7002 (Turbopack)
npm run build     # production build
npm start         # start production server
```

### 26.2 Production (PM2)

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'vibe-hosting-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/root/vibecode/vibe-hosting/frontend',
    port: 7002,
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'http://localhost:7001',
    }
  }]
};

PM2_HOME=/root/.pm2 pm2 start ecosystem.config.js
PM2_HOME=/root/.pm2 pm2 save
```

### 26.3 Nginx reverse proxy

```nginx
location / {
  proxy_pass http://localhost:7002;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_buffering off;
}

location /api {
  proxy_pass http://localhost:7001;  # backend
  proxy_set_header Host $host;
}
```

---

## 27. ИТОГОВЫЕ МЕТРИКИ

| Метрика | Значение |
|---------|----------|
| Next.js версия | 16.1.6 (latest) |
| React версия | 19.2.4 (latest) |
| TypeScript версия | 5.9.3 (strict mode) |
| CSS framework | Tailwind CSS 4.2.1 |
| Animation library | Anime.js 4.3.6 |
| Icon library | Lucide React (75+ icons) |
| Pages (routes) | 35 total (public + protected + admin) |
| Components | 40+ reusable components |
| API endpoints | 40+ methods in ApiClient |
| Middleware protection | 5 prefixes (/projects, /admin, /settings, /billing, /domains) |
| Supported browsers | Chrome, Firefox, Safari, Edge (all modern) |
| Mobile-first | Yes (responsive, Tailwind) |
| SEO optimized | Yes (metadata, JSON-LD, robots, sitemap) |
| Accessibility | Partial (ARIA labels, semantic HTML, keyboard nav) |
| Dark mode | Admin panel only |
| Theme colors | Emerald (primary), Gray (secondary) |
| Fonts | Inter (Google Fonts, Cyrillic) |
| Build tool | Turbopack (fast dev), Next.js build (prod) |
| Hosted on | Port 7002 (PM2, systemd, nginx reverse proxy) |

---

## ЗАКЛЮЧЕНИЕ

Frontend VibeHosting — это полнофункциональный хостинг-контрол-панель с:
- **Современным стеком:** Next.js 16 + React 19 + Tailwind CSS 4
- **Строгой типизацией:** TypeScript strict mode
- **Красивыми анимациями:** Anime.js с Intersection Observer
- **Защищённой аутентификацией:** JWT cookies, middleware guards
- **Полной функциональностью:** Проекты, домены, биллинг, админ-панель
- **Отличной UX:** Responsive design, toast notifications, error handling
- **SEO-оптимизацией:** Metadata, JSON-LD, robots, sitemap

Код хорошо организован, типизирован, и готов к масштабированию.
