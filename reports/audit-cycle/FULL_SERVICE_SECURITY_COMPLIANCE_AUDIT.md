# FULL SERVICE SECURITY + COMPLIANCE AUDIT — VibeHosting

**Дата аудита:** 2026-03-08  
**Объём:** backend + frontend + runtime scripts + Nginx-конфиг + legal/privacy/cookies consistency  
**Метод:** code review + config review (без intrusive/pentest-атак)

---

## 1) Executive summary

Сервис в целом уже имеет базовые меры защиты (bcrypt, rate-limit, проверка подписи webhook, валидация архивов, проверка ownership в ключевых API, идемпотентность payment events).  

Но обнаружены **существенные риски** в auth/session, secrets hygiene, header policy и compliance-плоскости:

- **2 High** риска по auth/session (хранение JWT в localStorage + query token acceptance).
- **1 Critical** риск по секретам/инфраструктуре (права доступа к `.env` и логам).
- **1 High** по session invalidation (смена пароля не инвалидирует старые JWT).
- **1 High** по browser hardening (CSP фактически выключен).
- **Несколько Medium** в webhook robustness и legal/privacy consistency.

Ниже — конкретика с remediation **без breaking changes**.

---

## 2) Findings by severity

## 🔴 CRITICAL

### C1. Небезопасные права на секреты и логи (secret exposure / integrity risk)
**Где:**
- `/root/vibecode/vibe-hosting/backend/.env` → mode `666`
- `/root/vibecode/vibe-hosting/logs` → mode `777`

**Риск:**
- Любой локальный пользователь/процесс может читать/менять секреты (JWT_SECRET, DB creds, payment keys, SMTP/Telegram).
- Возможна подмена логов и артефактов для сокрытия атак.

**OWASP mapping:** A05 Security Misconfiguration, A02 Cryptographic Failures (операционное хранение ключей).

**Remediation (no-break):**
1. Немедленно ужесточить права:
   - `.env` → `600`, owner root/service user.
   - директория логов → `750`, файлы логов `640`.
2. Привязать сервис к выделенному unix-user (не root для app процесса).
3. После изменения прав — **rotation всех чувствительных ключей**:
   - `JWT_SECRET`, `PRODAMUS_SECRET_KEY`, `SMTP_PASS`, `TELEGRAM_BOT_TOKEN`, DB/Redis creds.
4. Добавить startup-check в backend: fail-fast при небезопасных permission на `.env`.

---

## 🟠 HIGH

### H1. JWT хранится в `localStorage` + cookie без `HttpOnly` (token theft blast radius)
**Где:** `frontend/src/lib/api.ts` (`localStorage.setItem('vibe_token')`, cookie mirror через `document.cookie`).

**Риск:**
- Любая XSS в frontend/встраиваемых скриптах/расширениях браузера = прямой доступ к bearer token.
- Компрометация аккаунта до истечения токена (30 дней).

**OWASP mapping:** A07 Identification and Authentication Failures, A03 Injection (в сочетании с XSS).

**Remediation (без ломающего релиза, поэтапно):**
1. Phase 1 (совместимо):
   - Оставить текущий Bearer-флоу, но добавить серверную выдачу `Set-Cookie: vibe_token=...; HttpOnly; Secure; SameSite=Lax`.
   - На backend приоритетизировать HttpOnly-cookie, а не JS-токен.
2. Phase 2:
   - Перестать писать JWT в `localStorage`.
   - Удалить client-side cookie mirror через `document.cookie`.
3. Добавить short-lived access token + refresh token rotation (можно начать с 30d→12h access + refresh в HttpOnly).

---

### H2. Токены передаются/принимаются через query string
**Где:**
- `backend/src/middleware/auth.ts` — legacy `req.query.token`.
- `frontend/src/lib/api.ts` — `getEditPreviewUrl` добавляет `?token=`.
- `backend/src/routes/edit.ts` и `/api/internal/preview` используют query token.

**Риск:**
- Утечка токенов через access logs, browser history, referer, аналитические инструменты.

**OWASP mapping:** A01 Broken Access Control / A07 Auth failures (transport misuse).

**Remediation (no-break):**
1. Ввести feature-flag `ALLOW_QUERY_TOKEN=false` и по умолчанию выключить на prod.
2. Для preview использовать только cookie-based auth (`withCredentials`) + одноразовый короткоживущий preview token (60–120 сек, scoped to project/path).
3. Временно сохранить backward compatibility: если query token пришёл — принимать, но логировать warning и возвращать deprecation header.

---

### H3. Смена пароля не инвалидирует существующие JWT-сессии
**Где:** `backend/src/routes/auth.ts` (`change-password`, `reset-password`) не делают session/token revocation.

**Риск:**
- Украденный токен продолжает работать до expiry (30 дней), даже после смены пароля.

**OWASP mapping:** A07 Identification and Authentication Failures.

**Remediation (no-break):**
1. Добавить в `User` поле `tokenVersion` (int) или `authInvalidBefore` (timestamp).
2. В JWT включать `ver`/`iat`; в middleware отклонять токены со старой версией/датой.
3. При `change-password`, `reset-password`, `delete-account` увеличивать version / обновлять invalidBefore.

---

### H4. CSP фактически отключён; browser hardening неполный
**Где:** `backend/src/index.ts` (`helmet({ contentSecurityPolicy: false })`), в Next/Nginx нет строгого CSP.

**Риск:**
- При любой XSS значительно повышается шанс кражи токенов/данных.

**OWASP mapping:** A05 Security Misconfiguration, A03 Injection (impact multiplier).

**Remediation (поэтапно, без breaking):**
1. Ввести Report-Only CSP сначала (7–14 дней):
   - `default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru; connect-src 'self' https://hostingvibe.ru; img-src 'self' data: https://mc.yandex.ru; frame-ancestors 'self';`
2. Собрать violations, поправить исключения.
3. Переключить на enforce, постепенно убрать `unsafe-inline` через nonce для inline script.

---

## 🟡 MEDIUM

### M1. Webhook: идемпотентность в целом есть, но есть edge-case с `providerEventId`
**Где:** `backend/src/routes/billing.ts` (`providerEventId = payment_id || order_id`).

**Что хорошо:**
- Есть `PaymentEvent` + claim/processed/inflight flow.
- Есть timing-safe signature verify.

**Риск:**
- Если провайдер не пришлёт `payment_id`, dedupe по `order_id` может конфликтовать с повторными оплатами одного order/subscription сценария.
- В catch всегда `200 OK` (анти-шторм), но это может скрыть временные ошибки доставки и потерю события.

**Remediation:**
1. Предпочитать строго уникальный id события провайдера; при отсутствии — строить composite key из стабильных полей payload + timestamp/operation id.
2. Добавить `processedPayloadHash` и reject на mismatch при том же eventId.
3. Оставить `200` для signature-invalid/irrelevant, но для внутренних временных ошибок использовать controlled retry strategy (или queue + DLQ), чтобы не терять legitimate payments.

---

### M2. Consent/Legal acceptance не фиксируется в backend
**Где:**
- На фронте есть чекбокс согласия при регистрации.
- В БД нет поля/журнала факта согласия с версией документов.

**Риск (compliance):**
- Сложно доказать факт и версию акцепта условий/политики.

**Remediation:**
1. Добавить таблицу `legal_acceptances`:
   - `userId`, `docType`, `docVersion`, `acceptedAt`, `ipHash`, `userAgent`.
2. На `/auth/register` принимать `legalAccepted=true` + version и сохранять запись.
3. Для существующих пользователей — мягкий re-consent banner после обновления версии документов.

---

### M3. Privacy policy ↔ фактическая обработка данных: частичные несоответствия
**Наблюдения:**
1. Privacy говорит про IP в логах; фактически часть IP хранится в БД (`reports.reporterIp` как raw IP).
2. Cookie/analytics описаны корректно в целом, но нет явного описания retention по `formSubmissions`, `reports`, `emailEvents`, `paymentEvents`.

**Риск:**
- Юридическая уязвимость при претензиях/проверках (152-ФЗ/GDPR-like expectations).

**Remediation:**
1. Обновить Privacy: перечислить все категории данных и сроки хранения по каждой.
2. Для `reporterIp` перейти на salted hash (или raw IP + короткий retention 30–90 дней).
3. Внедрить scheduled data retention jobs (form submissions/report logs/email events).

---

### M4. Нет server-side enforcement сильной парольной политики
**Где:** `backend/src/routes/auth.ts` (минимум 6 символов).

**Риск:**
- Повышенная вероятность credential stuffing/success brute-force после утечки пароля на сторонних сервисах.

**Remediation (no-break):**
1. Плавно поднять требования (>=10, blacklist common passwords, optional zxcvbn score).
2. Для старых аккаунтов — policy on password change/reset first.
3. Добавить rate-limit per-account + IP и delayed response на repeated fails.

---

### M5. Публичные патчи доступны по slug без проверки статуса/видимости
**Где:** `backend/src/routes/edit.ts` (`publicPatchesRouter`).

**Риск:**
- Для не-LIVE/непубличных проектов можно получить набор селекторов/контента патчей, если известен slug.

**Remediation:**
1. Возвращать патчи только если `project.status==='LIVE'`.
2. Для приватных/парольных сайтов — требовать signed runtime key (мягкий rollout: сначала optional, затем mandatory).

---

## 🟢 LOW / GOOD PRACTICES CONFIRMED

1. Пароли хешируются `bcrypt`.
2. Есть rate limit middleware (`authLimiter`, `deployLimiter`, `apiLimiter`).
3. Webhook подпись проверяется через HMAC + timingSafeEqual.
4. Идемпотентность webhook частично реализована (`PaymentEvent`).
5. ZIP/TAR extraction имеет базовые защиты: forbidden extensions, path traversal checks, max file count/size, compression ratio.
6. Ownership checks для большинства resource endpoints присутствуют.

---

## 3) OWASP coverage matrix (кратко)

- **A01 Broken Access Control:** частично ок; риск query-token и публичных патчей.
- **A02 Cryptographic Failures:** bcrypt/JWT есть, но секреты на диске с unsafe permissions.
- **A03 Injection:** прямых SQLi не найдено (Prisma), но XSS blast radius высокий из-за token storage + слабой CSP.
- **A04 Insecure Design:** session revocation отсутствует.
- **A05 Security Misconfiguration:** CSP off, file permissions критично слабые.
- **A06 Vulnerable Components:** не оценивались CVE по lockfiles в этом цикле.
- **A07 Auth Failures:** long-lived JWT + no global revocation + weak password policy.
- **A08 Software/Data Integrity:** webhook flow в целом норм, но retries/loss handling нужно укрепить.
- **A09 Logging/Monitoring:** логирование есть, но нет явной redaction policy/retention policy.
- **A10 SSRF:** явных SSRF точек в просмотренных роутерах не найдено.

---

## 4) Приоритетный remediation-план (без breaking changes)

## Wave 1 (сразу, 24 часа)
1. Исправить права: `.env` 600, logs dir 750, log files 640.
2. Ротация всех секретов после hardening.
3. Отключить query-token на проде через flag (оставить временный fallback + warning).
4. Добавить user-wide token invalidation механизм (tokenVersion/authInvalidBefore) и применить на reset/change password.

## Wave 2 (3–7 дней)
1. Ввести HttpOnly cookie auth path + постепенный отказ от localStorage JWT.
2. Запустить CSP Report-Only, собрать репорты, подготовить enforce.
3. Усилить webhook event identity + controlled retry queue.

## Wave 3 (1–2 недели)
1. Внедрить legal acceptance audit trail (versioned).
2. Обновить Privacy/Terms/Offer на фактические data flows + retention.
3. Ввести retention jobs и минимизацию IP хранения в reports.
4. Ужесточить парольную политику без принудительного мгновенного reset.

---

## 5) Итог

Сервис уже не «сырой»: есть хорошая база по backend safety и billing signature/idempotency.  
Главный риск сейчас — **операционная безопасность секретов + токен-модель в браузере + неполная session hygiene**.  

После выполнения Wave 1/2 профиль риска снизится с **High** до **Medium-Low** без ломающих изменений UX/API.
