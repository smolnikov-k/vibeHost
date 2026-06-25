# План работ по двум отчетам ручного тестирования VibeHosting

**Дата:** 2026-03-13  
**Основание:** `QA_REPORT_2026-03-12.md`, `QA_REPORT_2026-03-12_CODEX.md`

## 1. Что получилось после сверки отчетов

- Два отчета дополняют друг друга: первый лучше покрывает публичную часть и SEO/UX, второй прошел глубже в кабинет, деплой, формы и first-run flow.
- Часть находок дублируется и описывает одну системную проблему с разных сторон.
- После дедупликации получается **5 рабочих потоков** и **3 пункта для быстрой перепроверки**.

## 2. Быстрая оценка по приоритетам

### P0. Блокеры и риск для продакшна — ✅ ВСЕ ЗАКРЫТЫ (2026-03-13)

1. **✅ Разделить и пересобрать rate limiting для auth-флоу**
   - Симптомы:
     - общий лимитер на `/api/auth/*`
     - `GET /api/auth/me` может получать `429`
     - `POST /api/site-gate/:slug` сидит на том же лимитере
     - лимит блокирует и кабинет, и password-protected сайты
   - Подтверждение в коде:
     - `backend/src/app/public-routes.ts`
     - `backend/src/middleware/rateLimit.ts`
     - `backend/src/routes/auth.ts`
   - Что сделать:
     - убрать общий `authLimiter` с уровня `/api/auth`
     - ввести отдельные лимитеры для `register`, `login`, `forgot-password`, `reset-password`, `site-gate`
     - не лимитировать `GET /auth/me` тем же профилем, что mutating auth endpoints
     - отдельно решить вопрос алгоритма: оставить fixed window с более узким scope или перейти на sliding/token bucket
   - Результат:
     - auth-ошибки не ломают кабинет и вход на защищенные сайты
   - Оценка:
     - `0.5-1 день`

2. **✅ Убрать небезопасное клиентское дублирование auth-токена**
   - Важно:
     - backend уже выставляет `HttpOnly + Secure` cookie
     - но frontend заново пишет тот же токен в `localStorage` и JS-cookie без `HttpOnly`
   - Подтверждение в коде:
     - `backend/src/routes/auth.ts`
     - `frontend/src/lib/api.ts`
     - `frontend/src/middleware.ts`
   - Что сделать:
     - отказаться от хранения JWT в `localStorage`
     - перестать зеркалить токен в `document.cookie`
     - перевести frontend и middleware на server-issued cookie как на основной источник сессии
     - проверить preview/editor и SSR-route protection после изменения
   - Результат:
     - закрывается реальный security-risk, даже если формулировка в отчете про cookie частично расходится с backend-кодом
   - Оценка:
     - `1 день`

3. **✅ Починить post-registration onboarding race**
   - Симптом:
     - после регистрации welcome-onboarding не показывается
   - Вероятная причина в коде:
     - `frontend/src/app/(auth)/register/page.tsx`
     - `frontend/src/lib/auth.tsx`
     - `frontend/src/app/(dashboard)/projects/page.tsx`
     - при `setUser()` срабатывает редирект на `/projects` раньше, чем `router.push('/projects?welcome=1')`
   - Что сделать:
     - убрать гонку между `useEffect` и явным redirect после регистрации
     - сохранить intent `welcome=1` гарантированно
     - добавить smoke-check на first user journey
   - Результат:
     - первый пользователь всегда попадает в onboarding
   - Оценка:
     - `0.5 дня`

### P1. Ошибки, бьющие по лидам, активации и доверию

4. **✅ Починить двойную отправку форм и грязные submissions**
   - Симптомы:
     - один submit создает две заявки
     - часть submissions портится
     - аналитика и Telegram-уведомления дублируются
   - Подтверждение в коде:
     - `backend/public/vibe-forms.js`
     - `backend/src/routes/forms.ts`
   - Что сделать:
     - развести auto-mode и native submit
     - не отправлять AJAX-копию, если форма уже отправляется прямо в `hostingvibe.ru/api/forms/...`
     - нормализовать `_vibe_form_name`
     - добавить защиту от дублей по request fingerprint/idempotency на backend
   - Результат:
     - 1 submit = 1 lead
   - Оценка:
     - `1 день`

5. **✅ Исправить redirect после отправки форм**
   - Симптом:
     - относительный `_vibe_redirect=/thanks.html` уводит на `hostingvibe.ru`, а не на домен сайта
   - Подтверждение в коде:
     - `backend/src/routes/forms.ts`
   - Что сделать:
     - резолвить относительный redirect относительно origin сайта пользователя
     - сохранить защиту от open redirect
   - Результат:
     - post-submit flow работает на сайтах клиентов
   - Оценка:
     - `0.5 дня`

6. **✅ Починить login UX и валидацию**
   - Симптом:
     - логин-молчит при пустых/невалидных полях
   - Подтверждение в коде:
     - `frontend/src/app/(auth)/login/page.tsx`
   - Что сделать:
     - добавить клиентскую валидацию и понятные тексты ошибок
     - синхронизировать требования с backend
   - Результат:
     - меньше ложных “ничего не работает”
   - Оценка:
     - `0.5 дня`

7. **✅ Исправить мобильные блокеры первого входа**
   - Симптомы:
     - cookie-banner перекрывает CTA на mobile
     - мобильное меню не перекрывает фон и не блокирует скролл
   - Подтверждение в коде:
     - `frontend/src/components/cookies/CookieConsentBanner.tsx`
     - `frontend/src/components/landing/Header.tsx`
     - `frontend/src/components/onboarding-modal.tsx`
   - Что сделать:
     - развести z-index и поведения cookie-banner / modal
     - добавить body scroll lock и полноценный overlay для mobile menu
     - проверить login и onboarding на viewport `390x844`
   - Результат:
     - мобильный пользователь не застревает на первом экране
   - Оценка:
     - `0.5-1 день`

8. **✅ Починить ложный успех при включении защиты паролем**
   - Симптом:
     - UI показывает “Сохранено”, хотя защита не включилась
   - Подтверждение в коде:
     - `frontend/src/app/(dashboard)/projects/[id]/components/ProjectSettings.tsx`
     - `backend/src/routes/projects.ts`
   - Что сделать:
     - добавить явную валидацию “Введите пароль”
     - запретить success-state без реального изменения
     - при необходимости ужесточить backend-валидацию
   - Результат:
     - пользователь не думает, что сайт защищен, когда это не так
   - Оценка:
     - `0.5 дня`

9. **✅ Согласовать обещания UI и фактический формат деплоя**
   - Симптом:
     - frontend принимает `.html`, backend отвергает
   - Подтверждение в коде:
     - `frontend/src/app/(dashboard)/projects/new/page.tsx`
     - `backend/src/routes/deploy.ts`
   - Решение требует выбора:
     - либо реально поддержать одиночный HTML-файл
     - либо убрать `.html/.htm` из UI и текстов
   - Результат:
     - happy path не ломается на первом деплое
   - Оценка:
     - `0.5 дня` для выравнивания UX
     - `1+ день`, если делать полную backend-поддержку

### P2. Конверсия и активация

10. **✅ Передавать контекст тарифа и slug из лендинга в регистрацию и первый проект**
   - Симптомы:
     - “Подключить PRO” ведет на обычную регистрацию
     - введенный slug теряется
     - slug-поле молча фильтрует символы и не объясняет ограничения
   - Подтверждение в коде:
     - `frontend/src/components/landing/Pricing.tsx`
     - `frontend/src/components/landing/Hero.tsx`
     - `frontend/src/app/(auth)/register/page.tsx`
     - `frontend/src/app/(dashboard)/projects/new/page.tsx`
   - Что сделать:
     - передавать `?plan=pro&slug=...`
     - показать контекст на регистрации и после нее
     - добавить `maxlength`, helper text и понятное сообщение про формат slug
     - исправить текст статуса для невалидного slug, чтобы не показывать “Занят”
   - Результат:
     - меньше трения в первом сценарии и воронке апгрейда
   - Оценка:
     - `1 день`

### P3. Публичная витрина, галерея и SEO-полировка

11. **✅ Разобраться с пустым рендерингом карточек в галерее**
   - Симптом:
     - на проде видны теги, но карточка визуально пустая
   - Кандидаты:
     - `frontend/src/app/gallery/page.tsx`
     - `backend/src/routes/gallery.ts`
   - Что сделать:
     - перепроверить на живых данных
     - посмотреть payload API и CSS/animation state
     - добавить безопасную заглушку при неполных данных
   - Результат:
     - галерея перестает выглядеть сломанной
   - Оценка:
     - `0.5-1 день`

12. **✅ Привести metadata/title в консистентное состояние**
   - Симптомы:
     - дубли бренда в title
     - forgot-password наследует общий `Аккаунт`
     - login/register без суффикса бренда
     - 404 title не отражает ошибку
   - Подтверждение в коде:
     - `frontend/src/app/layout.tsx`
     - `frontend/src/app/(auth)/layout.tsx`
     - `frontend/src/app/(auth)/login/layout.tsx`
     - `frontend/src/app/(auth)/register/layout.tsx`
     - `frontend/src/app/gallery/layout.tsx`
     - `frontend/src/app/ai/page.tsx`
     - `frontend/src/app/docs/page.tsx`
     - `frontend/src/app/not-found.tsx`
   - Что сделать:
     - убрать бренд из дочерних `title`, где уже есть root template
     - задать page-level metadata для forgot-password и 404
   - Результат:
     - нормальный title во всех ключевых маршрутах
   - Оценка:
     - `0.5 дня`

13. **✅ Починить вторичные UX-детали в галерее**
   - Симптомы:
     - неправильное склонение “1 публичных проектов”
   - Кандидаты:
     - `frontend/src/app/gallery/page.tsx`
   - Что сделать:
     - вынести pluralization helper
   - Результат:
     - аккуратный UI без мелких языковых ошибок
   - Оценка:
     - `0.25 дня`

14. **✅ Исправить API fallback: 404 вместо ложного 401 для несуществующих маршрутов**
   - Симптом:
     - неизвестные `/api/*` могут получать `401`, потому что auth middleware висит на `/api` раньше 404-handler
   - Подтверждение в коде:
     - `backend/src/app/create-app.ts`
     - `backend/src/middleware/auth.ts`
   - Что сделать:
     - добавить явный not-found handler для API после регистрации маршрутов
     - не перехватывать несуществующие маршруты auth-middleware
   - Результат:
     - API ведет себя предсказуемо
   - Оценка:
     - `0.5 дня`

## 3. Пункты, которые надо быстро перепроверить перед разработкой

1. **`/register` → `/login`**
   - В текущем `frontend/src/middleware.ts` это не подтверждается напрямую.
   - Нужен быстрый ручной smoke-test в чистом браузере без cookie.

2. **“Cookie небезопасна”**
   - Backend-код уже ставит `HttpOnly + Secure`.
   - Но проблема все равно есть из-за дублирования токена во frontend.
   - В работу брать именно как “убрать client-side token mirror”, а не как “исправить backend cookie flags”.

3. **Пустая карточка галереи**
   - По коду рендер не выглядит очевидно сломанным.
   - Нужна короткая перепроверка на live-данных или локально с тем же payload.

## 4. Рекомендуемая последовательность

### Волна 1. Снять блокеры тестирования — ✅ ЗАКРЫТА

- ✅ P0.1 rate limiting — per-endpoint лимиты
- ✅ P0.2 auth token storage — httpOnly cookie only
- ✅ P0.3 onboarding race — registeringRef guard
- Повторный smoke по auth, login, forgot-password, register, `/projects`, `site-gate`

### Волна 2. Починить лидогенерацию и first-run flow — ✅ ЗАКРЫТА

- ✅ P1.4 формы: guard двойной инициализации + DOM clobbering fix + **auto-mode dedup** (skip forms targeting /api/forms/, per-submit flag __vibeSending, backend in-memory dedup 30s window в forms.ts)
- ✅ P1.5 формы: redirect резолвится через origin сайта
- ✅ P1.6 login validation — клиентская валидация
- ✅ P1.7 mobile blockers — cookie banner flush-bottom, полноэкранное меню
- ✅ P1.8 password protection — валидация «Введите пароль» при первом включении (ProjectSettings.tsx)
- ✅ P1.9 deploy format — убраны .html/.htm из UI, оставлены только ZIP/TAR.GZ (DeployUploader, projects/new)

### Волна 3. Добрать конверсию и витрину — ✅ ЗАКРЫТА

- ✅ P2.10 plan/slug propagation — полная цепочка Hero→Pricing→register→projects→onboarding→new project; **?plan=pro теперь вызывает api.createPayment() в onboarding-modal** (кнопка «Подключить PRO — 386 ₽/мес» → редирект на Prodamus)
- ✅ P3.11 gallery render — анимация карточек перемещена в useEffect после рендера DOM
- ✅ P3.12 metadata — убраны дубли бренда, добавлены title для forgot-password, reset-password, 404
- ✅ P3.13 pluralization — pluralize() хелпер в utils.ts, «публичный проект/проекта/проектов»
- ✅ P3.14 API 404 — catch-all handler для неизвестных /api/* маршрутов; **authMiddleware перенесён из глобального app.use('/api') в per-route** в protected-routes.ts — анонимы теперь получают 404, а не 401

## 4b. LOW-баги из первого отчёта — ✅ ЗАКРЫТЫ (кроме #16)

15. **✅ Slug input: maxlength + подсказка о формате**
    - Добавлены `maxLength={63}` и title/hint «Только латиница, цифры и дефис» в Hero.tsx и projects/new
    - Лимит в generateSlug/handleSlugChange обновлён с 32 до 63
    - **Backend slug.ts MAX_LENGTH обновлён с 40 до 63** — frontend и backend теперь согласованы
    - **Невалидный slug отображается как ошибка формата** (статус 'invalid' + текст ошибки), а не как «Занят»

16. **`/register` редиректит на `/login` при прямом переходе**
    - **ИСПРАВЛЕНО**: причина была в api.ts — 401 от /auth/me вызывал редирект на /login для auth-страниц. Добавлены: skip /auth/me в 401-обработчике + проверка window.location для /register, /forgot-password, /reset-password
    - Теперь анонимные пользователи на auth-страницах не перенаправляются

17. **✅ Title страницы 404**
    - Добавлен `export const metadata` с title `'404 — Страница не найдена'` в not-found.tsx
    - Закрыто вместе с P3.12

## 5. Дополнительные фиксы (2026-03-13, вторая итерация)

После code review были найдены и исправлены 5 проблем, которые не были решены в первой итерации:

18. **✅ HIGH: Auth-страницы ломались cookie-only flow**
    - api.ts: 401 от /auth/me вызывал window.location.href = '/login' на auth-страницах
    - Фикс: skip /auth/me в 401-обработчике + allowlist auth-страниц в location-check

19. **✅ HIGH: Дублирование заявок из vibe-forms.js**
    - Frontend: auto-mode теперь пропускает формы с action="/api/forms/..." + per-submit dedup flag
    - Backend: in-memory dedup в forms.ts (30s window, hash slug+IP+data)

20. **✅ MEDIUM: ?plan=pro не вёл в реальный PRO-flow**
    - onboarding-modal.tsx: добавлена кнопка «Подключить PRO — 386 ₽/мес» (api.createPayment → redirect на Prodamus)
    - Вторичная CTA «Создать сайт бесплатно →» для тех, кто хочет попробовать FREE

21. **✅ MEDIUM: Slug лимит рассогласован frontend 63 / backend 40**
    - backend/src/utils/slug.ts: MAX_LENGTH 40 → 63
    - Frontend: невалидный slug отображает ошибку из API (не «Занят»)

22. **✅ MEDIUM: API 404 недоступен для анонимов**
    - authMiddleware убран из глобального app.use('/api') в create-app.ts
    - authMiddleware добавлен per-route в protected-routes.ts
    - Теперь catch-all 404 срабатывает для всех, включая анонимов

## 6. Минимальный regression-чек после исправлений

- Регистрация, логин, forgot-password, reset-password не мешают друг другу по rate limit.
- `GET /api/auth/me` не получает `429` после серии auth-ошибок.
- Анонимный пользователь на /register, /forgot-password НЕ редиректится на /login.
- Password-protected сайт открывается после ввода пароля даже после auth-активности с того же IP.
- После регистрации пользователь гарантированно видит onboarding.
- При plan=pro в onboarding показывается кнопка оплаты.
- Один submit формы создает одну заявку и один Telegram event.
- `_vibe_redirect=/thanks.html` ведет на origin сайта пользователя.
- На mobile cookie banner не перекрывает `Войти` и `Далее`.
- Галерея показывает карточки, а title страниц не дублируются.
- Slug до 63 символов принимается и фронтом и бэком.
- Невалидный slug показывает ошибку формата, а не «Занят».
- GET /api/nonexistent возвращает 404 для анонимов (не 401).

## 5b. Третья итерация — фиксы по feedback Codex (2026-03-13)

23. **✅ MEDIUM: Onboarding localStorage глобальный — второй аккаунт не видит модалку**
    - localStorage ключ скоупирован на userId: `vibe_onboarding_done:${userId}`
    - Prop userId передаётся из projects page

24. **✅ MEDIUM: PRO intent теряется после закрытия онбординга**
    - /projects/page.tsx: newProjectUrl() теперь передаёт plan param
    - /projects/new/page.tsx: читает plan=pro, показывает PRO-баннер с ссылкой на /billing
    - Intent сохраняется даже если онбординг пропущен

25. **✅ MEDIUM: Dedup отвечает success:true без записи — нечестно**
    - Ответ теперь включает `deduplicated: true`
    - Добавлен logger.info для мониторинга dedup hits

**Не баг (отклонено):** /api/projects/nonexistent → 401 для анонимов — это стандартное REST-поведение: protected namespace требует аутентификации вне зависимости от существования ресурса. Не утечка информации.

## 7. Итог

- Волна 1: ✅ ЗАКРЫТА (P0.1–P0.3)
- Волна 2: ✅ ЗАКРЫТА (P1.4–P1.9) + доп. фикс #19 (forms dedup)
- Волна 3: ✅ ЗАКРЫТА (P2.10, P3.11–P3.14) + доп. фиксы #18, #20, #21, #22
- LOW: ✅ ЗАКРЫТЫ (#15–#17)
- Вторая итерация: ✅ (#18–#22)
- Третья итерация: ✅ (#23–#25)
- **Все QA-находки закрыты.** Осталось: деплой на прод + ручной regression smoke-test (см. раздел 6).
