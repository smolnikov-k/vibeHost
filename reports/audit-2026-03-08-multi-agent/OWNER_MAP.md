# VibeHosting — OWNER_MAP (specialist-агенты и зоны ответственности)

Дата: 2026-03-08

## RACI-lite (кто за что отвечает)
- **A (Accountable):** project-core (главный владелец итерации)
- **R (Responsible):** specialist-агент по направлению
- **C (Consulted):** смежные агенты

---

## 1) Project-Core (A)
**Роль:** оркестрация, приоритизация, dependency-gates, финальная приемка UX/stability.  
**Ведет:**
- Единый backlog P0/P1/P2 и weekly sync.
- Решения по trade-offs «скорость vs стабильность». 
- Финальный go/no-go по релизам фаз.

---

## 2) Backend/Reliability Specialist (R)
**Зона:** стабильность API/deploy контура, queue/worker, runtime hardening.  
**Берет:**
- SQL naming bug hotfix + тест.
- PM2 restart RCA + remediation.
- Вынос build/deploy из API-процесса.
- request-id, error schema, SLO baseline.
**Consulted:** DB Architect, Analytics, Frontend.

## 3) DB Architect Specialist (R)
**Зона:** консистентность данных, идемпотентность платежей, хранение событий.  
**Берет:**
- `payment_events` + уникальности provider_event_id.
- Критичные constraints (в т.ч. deploy uniqueness).
- Partitioning и audit_log.
- Backup/PITR/restore drill контур.
**Consulted:** Backend, Economist, Analytics.

## 4) Frontend Specialist (R)
**Зона:** критичный UX-флоу, accessibility, metadata/SSR корректность.  
**Берет:**
- Keyboard dropzone + auth a11y.
- `/login` и `/register` metadata/canonical/semantic fixes.
- Оптимизация payload для auth/docs/legal.
- Mobile overflow fixes.
**Consulted:** Copywriter, Marketing, Legal.

## 5) Marketing Specialist (R)
**Зона:** acquisition UX, SEO-архитектура, воронка до signup.  
**Берет:**
- Canonical/sitemap/intent-cluster roadmap.
- Промежуточные CTA (demo/preview/test-deploy).
- Дорожка trust-компонентов на лендинге.
**Consulted:** Frontend, Copywriter, Analytics.

## 6) Copywriter/Content Specialist (R)
**Зона:** консистентность messaging и доверие в тексте.  
**Берет:**
- Удаление пустых/неподтвержденных claims.
- Единый tone across landing/docs/legal.
- Блоки guarantee/risk-reversal/FAQ near CTA.
**Consulted:** Marketing, Legal, PM.

## 7) Legal/Compliance Specialist (R)
**Зона:** privacy/consent/doc↔UI соответствие, договорная чистота.  
**Берет:**
- Обновление Privacy + Policy ПД + Cookie Policy.
- Consent banner + тексты согласий в формах.
- Offer/Terms: SLA/refund/autorenewal/claims consistency.
**Consulted:** Frontend, Backend, Copywriter.

## 8) Analytics Specialist (R)
**Зона:** измеримость UX и бизнес-результата, качество данных.  
**Берет:**
- Tracking plan + taxonomy + event contracts.
- Сквозные ID, UTM persistence, quality checks.
- MVP dashboards: activation/monetization/reliability.
**Consulted:** PM, Backend, Marketing, Economist.

## 9) Product Manager Specialist (R)
**Зона:** продуктовая логика и приоритеты по impact.  
**Берет:**
- 6-недельный roadmap и приоритизация RICE.
- Onboarding/activation решения (try-before-signup, checklist).
- Dependency-gates и критерии «готово» по фазам.
**Consulted:** все направления.

## 10) Economics Specialist (R)
**Зона:** юнит-экономика, pricing ladder, payback-готовность к scale.  
**Берет:**
- Валидация CM/LTV/CAC модели после фикса биллинга.
- Дизайн ценовых экспериментов (Lite/Pro/Business, annual).
- Stop/go критерии масштабирования acquisition.
**Consulted:** PM, Analytics, DB/Backend.

---

## Handoffs (чтобы работа шла без зависаний)
1. **Backend + DB -> Analytics:** стабильные события/поля до запуска дашбордов.
2. **PM + Backend -> Marketing/Copy/Legal:** утвержденный capability truth до правки текстов и оферты.
3. **Legal -> Frontend:** финальные consent-тексты до релиза форм.
4. **Analytics -> PM/Economics:** фактические результаты воронок до ценовых экспериментов.
5. **Project-Core:** закрывает каждый gate (G1..G4) и подтверждает переход к следующей фазе.

---

## Definition of Ownership
- У каждой задачи один явный **R-owner**.
- Если задача влияет на UX + стабильность одновременно, финальный арбитр — **Project-Core (A)**.
- Без owner задача в спринт не попадает.
