# Dark Theme Plan для VibeHosting Frontend

**Дата:** 2026-03-22
**Версия:** v1
**Статус:** ПЛАН (не начинали реализацию)

---

## 1. TAILWIND & INFRASTRUCTURE

### 1.1 Текущее состояние
- **Версия:** Tailwind CSS 4.2.1 (новая версия с `@theme`)
- **darkMode:** НЕ УКАЗАН (по умолчанию `media`)
- **CSS variables:** определены в `globals.css` в `@theme` блоке
- **Текущая цветовая палитра:** белый `bg-white`, серый `text-gray-900`, emerald accent
- **postcss.config.mjs:** минималистичный, плагин `@tailwindcss/postcss`

### 1.2 Что нужно добавить

#### tailwind.config.ts (СОЗДАТЬ)
```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class', // enable class-based dark mode
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

**Причина:** Tailwind 4.x требует явного конфига для `darkMode: 'class'`, иначе работает только `media` (system preference).

#### globals.css (ОБНОВИТЬ)
Добавить CSS variables для dark mode в `@theme`:

```css
@theme {
  /* Light mode (default) */
  --color-background-light: #ffffff;
  --color-foreground-light: #111827; /* gray-900 */
  --color-text-light: #1f2937; /* gray-800 */
  --color-border-light: #e5e7eb; /* gray-200 */
  --color-bg-secondary-light: #f3f4f6; /* gray-100 */
  --color-bg-tertiary-light: #f9fafb; /* gray-50 */

  /* Dark mode */
  --color-background-dark: #0f1117; /* GitHub-like */
  --color-foreground-dark: #f0f6fc; /* light gray */
  --color-text-dark: #c9d1d9; /* medium gray */
  --color-border-dark: #30363d;
  --color-bg-secondary-dark: #161b22;
  --color-bg-tertiary-dark: #0d1117;

  /* Semantic colors (used in both modes) */
  --color-emerald-50: #ecfdf5;
  --color-emerald-100: #d1fae5;
  --color-emerald-200: #a7f3d0;
  --color-emerald-300: #6ee7b7;
  --color-emerald-400: #34d399;
  --color-emerald-500: #10b981;
  --color-emerald-600: #059669;
  --color-emerald-700: #047857;
  --color-emerald-800: #065f46;
  --color-emerald-900: #064e3b;

  --color-green-400: #4ade80;
  --color-green-500: #22c55e;
  --color-green-600: #16a34a;

  --color-red-50: #fef2f2;
  --color-red-100: #fee2e2;
  --color-red-500: #ef4444;
  --color-red-600: #dc2626;

  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-200: #bfdbfe;
  --color-blue-500: #3b82f6;

  --color-amber-400: #facc15;
  --color-amber-500: #f59e0b;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

/* Light mode (default) */
:root {
  --bg: var(--color-background-light);
  --fg: var(--color-foreground-light);
  --text: var(--color-text-light);
  --border: var(--color-border-light);
  --bg-secondary: var(--color-bg-secondary-light);
  --bg-tertiary: var(--color-bg-tertiary-light);
}

/* Dark mode */
html.dark {
  --bg: var(--color-background-dark);
  --fg: var(--color-foreground-dark);
  --text: var(--color-text-dark);
  --border: var(--color-border-dark);
  --bg-secondary: var(--color-bg-secondary-dark);
  --bg-tertiary: var(--color-bg-tertiary-dark);
}

/* Skeleton animation — обновить для dark */
.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Selection — обновить для dark */
::selection {
  background-color: var(--color-emerald-400);
  color: var(--color-emerald-900);
}

html.dark ::selection {
  background-color: var(--color-emerald-600);
  color: #ffffff;
}
```

---

## 2. ROOT LAYOUT & THEME PROVIDER

### 2.1 ThemeProvider (СОЗДАТЬ)
**Файл:** `src/components/ThemeProvider.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  // Инициализация на клиенте (избежать hydration mismatch)
  useEffect(() => {
    setMounted(true);

    // Читаем сохранённую тему
    const savedTheme = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  function applyTheme(newTheme: Theme) {
    const html = document.documentElement;

    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', prefersDark);
    } else {
      html.classList.toggle('dark', newTheme === 'dark');
    }
  }

  function toggleTheme() {
    if (!theme) return;

    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  }

  // Слушаем системное предпочтение
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Предотвращаем flash — используем скрипт в <head>
  if (!mounted) return <>{children}</>;

  return (
    <div data-theme={theme} suppressHydrationWarning>
      {children}
    </div>
  );
}
```

### 2.2 layout.tsx (ОБНОВИТЬ)
```typescript
// В <head> добавить скрипт для чтения localStorage ДО рендера
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        const theme = localStorage.getItem('theme') || 'system';
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'system') {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
        }
      })();
    `,
  }}
/>
```

```typescript
// В <body> обновить class
<body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased transition-colors" suppressHydrationWarning>
  <ThemeProvider>
    {children}
  </ThemeProvider>
  ...
</body>
```

---

## 3. SHARED UI COMPONENTS: DARK MODE ТАБЛИЦА

### 3.1 Modal.tsx

| Элемент | Текущий (Light) | Dark Mode | CSS |
|---------|-----------------|-----------|-----|
| Container | `bg-white` | `dark:bg-gray-900` | border, shadow |
| Backdrop | `bg-black/50` | no change | CSS переменная не нужна |
| Close button | `text-gray-400 hover:text-emerald-600 hover:bg-gray-100` | `dark:text-gray-500 dark:hover:text-emerald-400 dark:hover:bg-gray-800` | transition |
| Title | `text-gray-900` | `dark:text-white` | font-bold |
| Content text | (inherited) | `dark:text-gray-300` | if needed |

**Обновить:** Строки 67, 74, 85, 92

---

### 3.2 ConfirmDialog.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Message text | `text-gray-600` | `dark:text-gray-400` | text-sm |
| Cancel button | `bg-gray-100 text-gray-700 hover:bg-gray-200` | `dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700` | |
| Confirm button | (depends on variant) | variant colors work in dark | emerald-600 → dark:emerald-500 |

**Обновить:** Строки 36, 41

**Вариант색:**
```
danger: dark:bg-red-900 dark:hover:bg-red-800 dark:text-white
warning: dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-white
default: dark:bg-emerald-700 dark:hover:bg-emerald-600 dark:text-white
```

---

### 3.3 ToastContainer.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Container | `bg-red-50 border-red-200 text-red-700` | `dark:bg-red-950 dark:border-red-800 dark:text-red-200` | animate |
| Success | `bg-emerald-50 border-emerald-200 text-emerald-700` | `dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200` | |
| Info | `bg-blue-50 border-blue-200 text-blue-700` | `dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200` | |
| Close icon | (inherited text) | (inherited) | no change |

**Обновить:** Строки 16-19 (colorMap)

---

### 3.4 ErrorBoundary.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Container | `text-center` | no change | centered |
| Icon circle | `bg-red-50` | `dark:bg-red-950` | |
| Title | `text-gray-900` | `dark:text-white` | font-semibold |
| Description | `text-gray-500` | `dark:text-gray-400` | |
| Button | `bg-emerald-500 hover:bg-emerald-600 text-white` | `dark:bg-emerald-600 dark:hover:bg-emerald-500` | |

**Обновить:** Строки 38, 41, 44, 49

---

### 3.5 onboarding-modal.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Overlay | `bg-black/40` | no change | backdrop |
| Card | `bg-white` | `dark:bg-gray-900` | rounded, shadow |
| Gradient header | `from-emerald-400 to-green-500` | (same, lighter in dark) | **no change** (градиент уже яркий) |
| Close button | `bg-white/20 hover:bg-white/30` | (white opacity works) | no change |
| Step dots | `bg-white` / `bg-white/40` | (white opacity works) | no change |
| Content h2 | `text-gray-900` | `dark:text-white` | font-bold |
| Content p | `text-gray-600` | `dark:text-gray-400` | |
| Tip box | `bg-gray-50 text-gray-400` | `dark:bg-gray-800 dark:text-gray-500` | |
| Button (primary) | `bg-gradient-to-r from-emerald-500 to-green-500` | `dark:from-emerald-600 dark:to-green-600` | |
| Button (secondary) | `text-gray-400 hover:text-gray-600` | `dark:text-gray-500 dark:hover:text-gray-400` | |

**Обновить:** Строки 129, 162, 165, 168, 180, 188, 194

---

### 3.6 QrCustomizer.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Main container | `bg-white` | `dark:bg-gray-900` | rounded, shadow |
| Header | `bg-white border-b border-gray-100` | `dark:bg-gray-900 dark:border-gray-800` | |
| Title | `text-gray-900` | `dark:text-white` | |
| Badge | `text-gray-400` | `dark:text-gray-500` | |
| Close button | `hover:bg-gray-100` | `dark:hover:bg-gray-800` | |
| QR list (left) | `border-b border-gray-100 p-4` | `dark:border-gray-800` | |
| QR item (selected) | `bg-emerald-50 text-emerald-700` | `dark:bg-emerald-950 dark:text-emerald-300` | |
| QR item (hover) | `text-gray-600 hover:bg-gray-50` | `dark:text-gray-400 dark:hover:bg-gray-800` | |
| Input field | `border border-gray-200 focus:ring-emerald-400` | `dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-emerald-500` | |
| Label | `text-gray-600` | `dark:text-gray-400` | |
| Button (emerald) | `bg-emerald-500 hover:bg-emerald-600` | `dark:bg-emerald-600 dark:hover:bg-emerald-500` | |
| Button (secondary) | `border border-gray-200 text-gray-600 hover:bg-gray-50` | `dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800` | |
| Preview box | `bg-gray-50` | `dark:bg-gray-800` | |
| Text placeholder | `text-gray-400` | `dark:text-gray-500` | |
| Option button (selected) | `bg-emerald-500 text-white` | `dark:bg-emerald-600` | |
| Option button (unselected) | `bg-gray-100 text-gray-600 hover:bg-gray-200` | `dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700` | |

**Обновить:** Строки 233, 235, 248, 254, 290, 303, 317, 323, 342, 357, 379, 394, 452, 466

---

### 3.7 CookieConsentBanner.tsx

| Элемент | Текущий | Dark Mode | CSS |
|---------|---------|-----------|-----|
| Banner | `bg-white/95 border-gray-200` | `dark:bg-gray-900/95 dark:border-gray-800` | |
| Title | `text-gray-900` | `dark:text-white` | |
| Description | `text-gray-600` | `dark:text-gray-400` | |
| Link | `text-emerald-600 hover:text-emerald-700` | `dark:text-emerald-400 dark:hover:text-emerald-300` | |
| Small text | `text-gray-500` | `dark:text-gray-500` | (может быть, одинаково) |
| Accept button | `bg-emerald-500 hover:bg-emerald-600 text-white` | `dark:bg-emerald-600 dark:hover:bg-emerald-500` | |
| Reject button | `border border-gray-200 text-gray-700 hover:bg-gray-50` | `dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800` | |

**Обновить:** Строки 28, 29, 30, 36, 46, 53

---

## 4. LANDING КОМПОНЕНТЫ (HIGHER LEVEL)

**Файлы:**
- `src/components/landing/Header.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/Pricing.tsx`
- `src/components/landing/Testimonials.tsx`
- `src/components/landing/FAQ.tsx`
- `src/components/landing/Footer.tsx`
- (и др.)

**Подход для каждого компонента:**
1. Основной фон: `bg-white dark:bg-gray-950`
2. Вторичный фон (секции): `bg-gray-50 dark:bg-gray-900`
3. Карточки: `bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800`
4. Текст: `text-gray-900 dark:text-white`, `text-gray-600 dark:text-gray-400`
5. Accent: Emerald остаётся (может быть, немного ярче в dark)
6. Иконки: `text-gray-400 dark:text-gray-600`

**Пример Header:**
```typescript
<header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
  <nav className="flex items-center justify-between px-6 py-4">
    {/* Logo — no change */}
    <img src="/logo.svg" alt="VibeHosting" />

    {/* Nav links */}
    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
      Features
    </a>

    {/* Theme toggle */}
    <ThemeToggle />
  </nav>
</header>
```

---

## 5. THEME TOGGLE КОМПОНЕНТ

**Файл:** `src/components/ThemeToggle.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(savedTheme);
  }, []);

  function toggleTheme() {
    if (!theme) return;

    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);

    const html = document.documentElement;
    if (nextTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', prefersDark);
    } else {
      html.classList.toggle('dark', nextTheme === 'dark');
    }
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' && <Sun className="w-5 h-5" />}
      {theme === 'dark' && <Moon className="w-5 h-5" />}
      {theme === 'system' && <Sun className="w-5 h-5" />} {/* or custom icon */}
    </button>
  );
}
```

**Где разместить:**
1. **Landing Header:** `src/components/landing/Header.tsx` (верхний правый угол)
2. **Dashboard Layout:** `src/app/(dashboard)/layout.tsx` (в меню или header)

---

## 6. ФЛЕШ-СКРИПТ (ПРЕДОТВРАЩЕНИЕ FLASH)

Добавить в `src/app/layout.tsx` внутри `<head>`:

```typescript
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          const theme = localStorage.getItem('theme') || 'system';
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

          const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } catch (e) {}
      })();
    `,
  }}
/>
```

**Причина:** Скрипт выполняется ДО рендера React, поэтому избегаем flash when page loads.

---

## 7. ПОЛНЫЙ CHECKLIST ФАЙЛОВ ДЛЯ ИЗМЕНЕНИЯ

### Core (обязательно)
- [x] `src/app/globals.css` — CSS variables + skeleton/selection + root/dark vars
- [x] `src/app/layout.tsx` — флеш-скрипт + body class + ThemeProvider
- [x] `tailwind.config.ts` (СОЗДАТЬ) — darkMode: 'class'
- [x] `src/components/ThemeProvider.tsx` (СОЗДАТЬ) — инициализация + system preference listener
- [x] `src/components/ThemeToggle.tsx` (СОЗДАТЬ) — toggle button

### Shared UI Components
- [ ] `src/components/ui/Modal.tsx` — 6 строк
- [ ] `src/components/ui/ConfirmDialog.tsx` — 2 строки
- [ ] `src/components/ToastContainer.tsx` — colorMap
- [ ] `src/components/ErrorBoundary.tsx` — 4 строки
- [ ] `src/components/onboarding-modal.tsx` — 10 строк
- [ ] `src/components/qr/QrCustomizer.tsx` — 15+ строк
- [ ] `src/components/cookies/CookieConsentBanner.tsx` — 6 строк

### Landing Components
- [ ] `src/components/landing/Header.tsx` — navbar, toggle button
- [ ] `src/components/landing/Hero.tsx` — bg, text, button colors
- [ ] `src/components/landing/Features.tsx` — cards, icons
- [ ] `src/components/landing/Pricing.tsx` — cards, plans, buttons
- [ ] `src/components/landing/Testimonials.tsx` — cards, avatars
- [ ] `src/components/landing/FAQ.tsx` — accordion, text
- [ ] `src/components/landing/Footer.tsx` — bg, links
- [ ] `src/components/landing/Stats.tsx` — text, icons
- [ ] `src/components/landing/Comparison.tsx` — table rows
- [ ] `src/components/landing/CTA.tsx` — button
- [ ] `src/components/landing/TrustSignals.tsx` — logos, text
- [ ] `src/components/landing/SocialProof.tsx` — cards
- [ ] `src/components/landing/HowItWorks.tsx` — steps
- [ ] `src/components/landing/UseCases.tsx` — cards
- [ ] `src/components/landing/Showcase.tsx` — carousel/gallery

### Dashboard Layout & Pages
- [ ] `src/app/(dashboard)/layout.tsx` — sidebar, header, toggle
- [ ] `src/app/(dashboard)/page.tsx` — dashboard main
- [ ] `src/app/(dashboard)/projects/page.tsx` — project list
- [ ] `src/app/(dashboard)/projects/[id]/page.tsx` — project details
- [ ] `src/app/(dashboard)/projects/[id]/edit/page.tsx` — editor (ВАЖНО! редактор может быть сложным)
- [ ] `src/app/(dashboard)/billing/page.tsx` — billing
- [ ] `src/app/(dashboard)/settings/page.tsx` — settings

### Auth Pages
- [ ] `src/app/(auth)/login/page.tsx` — auth form
- [ ] `src/app/(auth)/register/page.tsx` — registration form
- [ ] `src/app/(auth)/reset-password/page.tsx` — if exists
- [ ] `src/app/(auth)/layout.tsx` — auth layout

### Other Components
- [ ] `src/components/admin/ArticleEditor.tsx` — if used in admin
- [ ] Any modal/overlay components (not in ui/)
- [ ] Any form components

### Проверка
- [ ] Vercel preview — все компоненты видны
- [ ] Тест всех состояний: light → dark → system
- [ ] Тест localStorage persistence
- [ ] Тест system preference change
- [ ] Flash test (disable JS, refresh, check no flash)
- [ ] Контрастность текста в dark mode (WCAG AA minimum)
- [ ] Скриншоты: landing light/dark, dashboard light/dark, editor light/dark

---

## 8. ОЦЕНКА ЧАСОВ

| Задача | Часы | Примечание |
|--------|------|-----------|
| Setup (tailwind.config + globals.css + ThemeProvider) | 1 | проверка флеш-скрипта |
| Shared UI Components (7 файлов) | 1 | простые replace dark: классы |
| Landing Components (15 файлов) | 4 | много карточек, градиентов, иконок |
| Dashboard Layout & Pages (8 файлов) | 3 | сложнее, больше вариаций |
| Auth Pages (4 файла) | 0.5 | форм-стили |
| Admin/Other Components | 0.5 | если есть |
| Testing & QA | 2 | проверка всех путей, контрастность, производительность |
| **TOTAL** | **12 часов** | (может быть 10-14 в зависимости от сложности editor) |

---

## 9. ТЕМНЫЙ ЦВЕТОВОЙ PALLETE (REFERENCE)

```css
/* Backgrounds */
bg-gray-950: #030712 (darkest)
bg-gray-900: #111827
bg-gray-800: #1f2937
bg-gray-700: #374151

/* Text */
text-gray-100: #f3f4f6
text-gray-300: #d1d5db
text-gray-400: #9ca3af
text-gray-500: #6b7280

/* Accent (emerald — работает хорошо в dark) */
emerald-400: #34d399 (на dark фоне ярче смотрится)
emerald-500: #10b981
emerald-600: #059669
emerald-700: #047857 (для hover)

/* Semantic (тосты) */
red-950: #7f1d1d
blue-950: #0c2340
amber-950: #54340f
```

---

## 10. IMPLEMENTATION STRATEGY

### Phase 1: Infrastructure (1 час)
1. Создать `tailwind.config.ts`
2. Обновить `globals.css` (CSS variables)
3. Создать `ThemeProvider.tsx`
4. Обновить `layout.tsx` (скрипт + provider)
5. Создать `ThemeToggle.tsx`
6. Тест basic toggle в browser console

### Phase 2: Shared Components (1 час)
1. `Modal.tsx`, `ConfirmDialog.tsx`, `ToastContainer.tsx`, `ErrorBoundary.tsx`
2. `onboarding-modal.tsx`, `QrCustomizer.tsx`, `CookieConsentBanner.tsx`
3. Визуальная проверка в Storybook (если есть) или в dev

### Phase 3: Landing (4 часа)
1. Header + Footer (foundational)
2. Hero, Features, Pricing (main sections)
3. Testimonials, FAQ, Comparison (supporting)
4. Stats, CTA, HowItWorks, UseCases, Showcase (detail sections)
5. Проверка на разных размерах (mobile, tablet, desktop)

### Phase 4: Dashboard (3 часа)
1. Layout + sidebar + top navigation
2. Project pages (list, details)
3. Editor (может быть сложно, если много nested components)
4. Billing, settings

### Phase 5: QA & Polish (2 часа)
1. Контрастность текста (используем lighthouse или WAVE)
2. Тест localStorage, system preference, toggle переходов
3. Тест flash (disable JS)
4. Performance (dark mode не должен добавить penalty)

---

## 11. NOTES & GOTCHAS

### Tailwind CSS 4.x Special Cases
- `@theme` блок в `globals.css` уже содержит цветовую палитру — **не нужен** `theme.extend.colors` в `tailwind.config.ts`
- `darkMode: 'class'` должен быть в конфиге, иначе `dark:` префиксы не будут работать
- CSS переменные читаются из `@theme`, но для dark variables нужны селекторы `html.dark { --var: ... }`

### React Hydration
- Скрипт в `<head>` выполнится до гидрации, поэтому нет mismatch
- `suppressHydrationWarning` нужен на `<html>` и `<body>` (уже есть в коде)
- `mounted` check в компонентах, чтобы избежать hydration issues

### Performance
- CSS variables + `dark:` классы — zero JavaScript overhead в браузере (после initial setup)
- localStorage чтение — sync, очень быстро (~1ms)
- System preference listener — lazy loaded только если `theme === 'system'`

### Browser Support
- `class` dark mode — IE11 not supported (OK, не поддерживаем)
- CSS variables — всё, кроме IE11 (OK)
- `prefers-color-scheme` — IE11 not supported (OK, fallback к light mode)

### Accessibility
- ☑ Text contrast в dark mode должна быть не хуже light
- ☑ Focus states должны быть видны в обоих modes
- ☑ Не полагаться на цвет для информации (borders, icons тоже важны)
- ☑ Toggle button должен иметь `aria-label`

---

## 12. FUTURE IMPROVEMENTS (не в scope)

- [ ] Per-component theme (if some components need special handling)
- [ ] Тестирование в реальных условиях (например, в iOS Safari dark mode)
- [ ] Интеграция с дизайн-системой (если сделаете Design Tokens)
- [ ] OLED optimization (чёрный #000 вместо #030712 для OLED экранов)
- [ ] Animated theme transition (если нужна красивая анимация переключения)

---

**Дата создания:** 2026-03-22
**Версия плана:** 1.0
**Статус:** READY FOR IMPLEMENTATION
