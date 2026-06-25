# VibeHosting Feature Audit — Executive Summary

**Дата:** 2026-03-21  
**Аудитор:** Claude Code (Auditor Agent)  
**Охват:** Все 10 основных фич + 11 (GitHub Deploy) + анализ security/performance  
**Статус:** ✅ COMPLETE

---

## 📋 Audit Overview

Проведён глубокий анализ каждой фичи VibeHosting платформы:

| # | Фича | Статус | Реализация | Проблемы | Приоритет |
|---|------|--------|-----------|----------|-----------|
| 1 | Деплой ZIP | ✅ Полная | ZIP + TAR.GZ, auto-build, версионирование | Build без sandbox | Высокий |
| 2 | Визуальный редактор | ✅ Полная | CSS selector-based patches, live preview | No undo/redo, no versioning | Средний |
| 3 | Формы → Telegram | ✅ Полная | Auto-capture, dedup, Telegram bot | Нет rate-limit | Высокий |
| 4 | QR-коды | ❌ Не реализовано | Пакета нет, эндпоинта нет | Feature gap | Низкий |
| 5 | Кастомные домены | ✅ Полная | DNS + Let's Encrypt SSL, Nginx | Timing race, no email verify | Средний |
| 6 | Яндекс.Метрика | ✅ Полная | Автоинъекция счётчика ID | Нет дашборда, дубли возможны | Низкий |
| 7 | Пароль-защита | ✅ Полная | HMAC cookies, Nginx auth_request | Нет rate-limit на bruteforce | Высокий |
| 8 | Тарифы Free/Pro | ✅ Полная | Лимиты при creation/deploy, Prodamus billing | Нет downgrade cleanup | Средний |
| 9 | Галерея сайтов | ✅ Полная | Public showcase, likes, tags, search | Memory leaks, slow aggregation | Средний |
| 10 | Автосборка | ✅ Полная | npm build + output detection | Hook removal could break packages | Средний |
| 11 | GitHub Deploy | ✅ Полная | Shallow clone + deploy | No private repo support | Низкий |

---

## 🔴 Критические находки

### 1. **Build Process Security** (HIGH)
- ⚠️ `npm run build` работает без sandbox на хосте
- **Risk:** вредоносный build script может читать `/sites/*/` файлы других пользователей
- **Текущая защита:** safe env (no secrets), 3-min timeout, --ignore-scripts
- **Gap:** нет cgroup/chroot/container isolation

**Рекомендация:** Внедрить container-per-build (Docker или systemd-run)

### 2. **Rate-Limiting Issues** (HIGH)
- ❌ Нет rate-limit на `/api/site-password` (bruteforce attack)
- ❌ Нет rate-limit на `/api/forms/:slug` (spam forms)
- ❌ Нет rate-limit на `/api/gallery/:slug/like` (like spam)

**Рекомендация:** Добавить Redis-based rate-limit middleware

### 3. **Memory Leaks in-memory Maps** (MEDIUM)
- `guestLikes`, `recentViews`, `recentSubmissions` — unbounded maps
- Cleanup every 10 min, но if exceeds limit → drop half (неточный)
- **Risk:** при high traffic → memory bloat

**Рекомендация:** Migrate на Redis, implement LRU eviction

---

## 🟡 Важные проблемы

### 4. **Feature Gap: QR-коды** (MEDIUM)
- Заявлена в спеке, но не реализована
- Нет пакета, нет эндпоинта, нет UI компонента
- Use case: sharing сайта по QR code

**Рекомендация:** Добавить `qrcode` пакет, endpoint `GET /api/projects/:id/qr`

### 5. **Database Indexing** (MEDIUM)
- `VisualPatch.selector` используется в WHERE, но нет индекса
- `FormSubmission.data` JSON field — нет индекса на вложенные поля
- `PageView.country` — используется в aggregation, нет индекса

**Рекомендация:** Добавить индексы на часто используемые поля

### 6. **Deployment Logging** (MEDIUM)
- Нет логов процесса деплоя для дебага
- Только `status` и `errorMessage` в БД
- Stderr из build не сохраняется

**Рекомендация:** Добавить `deploymentLog` таблицу с full output

### 7. **Analytics Privacy** (MEDIUM)
- `PageView.ip` сохраняется в plaintext
- GDPR требует anonymization

**Рекомендация:** Hash IP или сохранять только country

---

## 🟢 Сильные стороны

✅ **Безопасность деплоя:** валидация расширений, symlink removal, safe build environment  
✅ **Автоматизм:** auto-inject forms/patches/analytics/Metrika скрипты  
✅ **Версионирование:** easy rollback, atomic swaps, backup система  
✅ **Интеграции:** Telegram, Яндекс.Метрика, Let's Encrypt, Prodamus  
✅ **Rate-limiting:** на deploy endpoints существует  

---

## 📊 Статистика

- **Всего эндпоинтов:** 50+
- **Маршрутов:** backend/src/routes/*.ts (11 файлов)
- **Services:** 10+ специализированных сервисов
- **Database models:** 18 (вкл. Deployment, VisualPatch, FormSubmission)
- **Строк кода:** ~15,000 (backend + frontend)

---

## 🎯 Top 5 приоритетов для fix

1. **Build Sandboxing** — container-per-build
2. **Rate-limiting** — password, forms, likes endpoints
3. **QR-код generation** — feature completeness
4. **Database indexing** — performance (selector, data)
5. **Deployment logs** — debugging & compliance

---

## 📈 Estimated Effort

| Task | Effort | Risk | Impact |
|------|--------|------|--------|
| Build sandbox | 3-5 days | MEDIUM | HIGH |
| Rate-limiting | 2 days | LOW | HIGH |
| QR codes | 1 day | LOW | MEDIUM |
| DB indexes | 1 day | LOW | MEDIUM |
| Deployment logs | 1 day | LOW | MEDIUM |

**Всего:** ~1-2 недели для всех приоритетов

---

## 📁 Документация

- **Полный аудит:** `/root/vibecode/vibe-hosting/AUDIT_FEATURES.md` (900 строк)
- **Детали по каждой фиче:** 10 разделов + дополнительные находки
- **Код references:** все файлы и строки указаны

---

**Дата:** 2026-03-21  
**Статус:** ✅ Ready for review  
**Следующий шаг:** Implement fixes по приоритетам
