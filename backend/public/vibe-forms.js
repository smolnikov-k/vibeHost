/**
 * VibeHosting Forms — тихая пересылка данных форм в Telegram
 *
 * Авто-режим (инжектится при деплое):
 *   <script src="https://hostingvibe.ru/api/vibe-forms.js" data-vibe-auto data-slug="my-site"></script>
 *   Перехватывает ВСЕ формы на странице, тихо отправляет данные на сервер.
 *   Сайт работает как обычно — ничего не ломается.
 *
 * Ручной режим:
 *   <form data-vibe-form data-vibe-slug="my-site">
 *   Перехватывает только формы с data-vibe-form, показывает "Отправлено".
 */
(function () {
  'use strict';

  // Guard against double initialization (auto-injection + manual include)
  if (window.__vibeFormsInit) return;
  window.__vibeFormsInit = true;

  var API_BASE = 'https://hostingvibe.ru/api';
  var API = API_BASE + '/forms/';
  var QUEUE_KEY = '__vibe_form_queue';
  var MAX_RETRIES = 3;
  var RETRY_DELAY = 2000;
  var script = document.currentScript;
  var autoMode = script && script.hasAttribute('data-vibe-auto');
  var globalSlug = script && script.getAttribute('data-slug');
  var globalMetrikaId = sanitizeCounterId(script && script.getAttribute('data-metrika-id'));
  var siteContextPromise = null;

  function normalizeHost(value) {
    return String(value || '').toLowerCase().replace(/:\d+$/, '');
  }

  function sanitizeSlug(value) {
    var slug = String(value || '').toLowerCase().trim();
    return /^[a-z0-9][-a-z0-9]*$/.test(slug) ? slug : null;
  }

  function sanitizeCounterId(value) {
    var id = String(value || '').replace(/\D/g, '');
    return id || null;
  }

  function getSlugFromHost() {
    var match = normalizeHost(location.hostname).match(/^([a-z0-9-]+)\.hostingvibe\.ru$/);
    return match ? sanitizeSlug(match[1]) : null;
  }

  function getSlugFromMeta() {
    var meta = document.querySelector('meta[name="vibe-slug"]');
    return sanitizeSlug(meta && meta.getAttribute('content'));
  }

  function detectMetrikaIdFromPage() {
    for (var i = 0; i < document.scripts.length; i++) {
      var text = document.scripts[i].textContent || '';
      var match = text.match(/ym\((\d+),\s*["']init["']/);
      if (match) return sanitizeCounterId(match[1]);
    }
    return null;
  }

  function getLocalContext() {
    return {
      slug: sanitizeSlug(globalSlug) || getSlugFromHost() || getSlugFromMeta(),
      metrikaId: globalMetrikaId || detectMetrikaIdFromPage(),
    };
  }

  function ensureSiteContext() {
    if (siteContextPromise) return siteContextPromise;

    siteContextPromise = Promise.resolve().then(function () {
      var local = getLocalContext();
      if ((local.slug && local.metrikaId) || typeof fetch !== 'function') {
        return local;
      }

      var host = normalizeHost(location.hostname);
      if (!host) return local;

      return fetch(API_BASE + '/site-context?host=' + encodeURIComponent(host), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Accept': 'application/json' },
      })
        .then(function (res) {
          if (!res.ok) throw new Error('site-context ' + res.status);
          return res.json();
        })
        .then(function (payload) {
          return {
            slug: local.slug || sanitizeSlug(payload && payload.slug),
            metrikaId: local.metrikaId || sanitizeCounterId(payload && payload.metrikaId),
          };
        })
        .catch(function () {
          return local;
        });
    });

    return siteContextPromise;
  }

  // Яндекс.Метрика: отправить цель при отправке формы
  function sendMetrikaGoal(formName) {
    ensureSiteContext().then(function (context) {
      if (context && context.metrikaId && window.ym) {
        try {
          window.ym(Number(context.metrikaId), 'reachGoal', 'form_submit', { form_name: formName || 'unknown' });
        } catch (e) { /* ignore */ }
      }
    });
  }

  // Определяем имя формы по контексту
  function detectFormName(form) {
    // 1. Явно указано через data-vibe-form-name
    var explicit = form.getAttribute('data-vibe-form-name');
    if (explicit) return explicit;

    // 2. По id или name формы (getAttribute avoids DOM clobbering by <input name="id">)
    var formId = form.getAttribute('id');
    if (formId) return formId;
    var formNameAttr = form.getAttribute('name');
    if (formNameAttr) return formNameAttr;

    // 3. Ищем заголовок внутри формы или в родительском блоке
    var heading = form.querySelector('h1, h2, h3, h4, h5, h6');
    if (!heading) {
      var parent = form.closest('section, .modal, [class*="popup"], [class*="modal"], [id]');
      if (parent) {
        heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
      }
    }
    if (heading && heading.textContent.trim()) {
      return heading.textContent.trim().substring(0, 60);
    }

    // 4. По кнопке submit
    var btn = form.querySelector('[type="submit"], button:not([type])');
    if (btn && btn.textContent.trim()) {
      return 'Форма: ' + btn.textContent.trim().substring(0, 40);
    }

    // 5. По контейнеру (modal, popup, section id)
    var container = form.closest('[id]');
    if (container && container.id) return container.id;

    // 6. Порядковый номер формы на странице
    var allForms = document.querySelectorAll('form');
    for (var i = 0; i < allForms.length; i++) {
      if (allForms[i] === form) return 'Форма #' + (i + 1);
    }

    return 'Форма';
  }

  // --- Capture form data synchronously from a form element ---
  function captureFormData(form) {
    var data = new FormData(form);
    var json = {};
    data.forEach(function (value, key) {
      json[key] = value;
    });
    json['_vibe_form_name'] = detectFormName(form);
    return json;
  }

  // --- Check if captured json has any real (non-internal) fields with values ---
  function hasRealData(json) {
    for (var key in json) {
      if (key.charAt(0) === '_' && key.indexOf('_vibe_') === 0) continue;
      if (json[key] && String(json[key]).trim() !== '') return true;
    }
    return false;
  }

  // --- localStorage queue for failed submissions ---
  function loadQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveQueue(queue) {
    try {
      // Keep max 50 entries, drop oldest
      if (queue.length > 50) queue = queue.slice(-50);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) { /* storage full or disabled */ }
  }

  function enqueue(slug, json) {
    var queue = loadQueue();
    queue.push({ slug: slug, data: json, ts: Date.now() });
    saveQueue(queue);
  }

  // --- Send with retry ---
  function postForm(slug, json, attempt) {
    if (!attempt) attempt = 1;
    return fetch(API + slug, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'VibeForm' },
      body: JSON.stringify(json),
    }).then(function (res) {
      if (!res.ok && attempt < MAX_RETRIES) {
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(postForm(slug, json, attempt + 1)); }, RETRY_DELAY * attempt);
        });
      }
      return res;
    }).catch(function (err) {
      if (attempt < MAX_RETRIES) {
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(postForm(slug, json, attempt + 1)); }, RETRY_DELAY * attempt);
        });
      }
      throw err;
    });
  }

  // --- Flush queued submissions from localStorage ---
  function flushQueue() {
    var queue = loadQueue();
    if (!queue.length) return;

    // Remove entries older than 24h
    var cutoff = Date.now() - 24 * 60 * 60 * 1000;
    queue = queue.filter(function (item) { return item.ts > cutoff; });

    if (!queue.length) {
      saveQueue([]);
      return;
    }

    var remaining = [];
    var sending = queue.slice(); // copy
    saveQueue([]); // clear immediately to avoid double-send on parallel loads

    sending.forEach(function (item) {
      postForm(item.slug, item.data, 1).catch(function () {
        remaining.push(item);
        saveQueue(remaining);
      });
    });
  }

  function sendData(form) {
    // Capture form data synchronously — the site's own handler may reset the form
    var json = captureFormData(form);

    // Don't send empty forms
    if (!hasRealData(json)) return;

    ensureSiteContext().then(function (context) {
      var slug = sanitizeSlug(form.getAttribute('data-vibe-slug')) || (context && context.slug) || getLocalContext().slug;
      if (!slug) return;

      // Save to queue first as safety net
      enqueue(slug, json);

      postForm(slug, json, 1).then(function () {
        // Success — remove from queue
        var queue = loadQueue();
        // Remove the entry we just sent (match by data+slug)
        var jsonStr = JSON.stringify(json);
        queue = queue.filter(function (item) {
          return !(item.slug === slug && JSON.stringify(item.data) === jsonStr);
        });
        saveQueue(queue);
      }).catch(function () {
        // Already in queue, will retry on next page load
      });
    });
  }

  function initAuto() {
    // Перехватываем submit на всех формах через capture phase
    // Это срабатывает ДО обработчиков сайта — мы просто копируем данные
    // Пропускаем формы с data-vibe-form — их обрабатывает initManual()
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form && form.tagName === 'FORM' && !form.hasAttribute('data-vibe-form')) {
        // Skip forms that natively submit to our forms API (prevents double lead)
        var action = form.getAttribute('action') || '';
        if (action.indexOf('/api/forms/') !== -1) return;

        // Dedup: skip if this form was already captured in this submit cycle
        if (form.__vibeSending) return;
        form.__vibeSending = true;
        setTimeout(function () { form.__vibeSending = false; }, 3000);

        sendData(form);
        sendMetrikaGoal(detectFormName(form));
      }
    }, true);
  }

  function initManual() {
    var forms = document.querySelectorAll('[data-vibe-form]');
    for (var i = 0; i < forms.length; i++) {
      bindManualForm(forms[i]);
    }
  }

  function bindManualForm(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // Capture form data synchronously — the site's own handler may reset the form
      var json = captureFormData(form);

      // Don't send empty forms
      if (!hasRealData(json)) return;

      var btn = form.querySelector('[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.dataset.vibeOrigText = btn.textContent;
        btn.textContent = 'Отправка...';
      }

      ensureSiteContext().then(function (context) {
        var slug = sanitizeSlug(form.getAttribute('data-vibe-slug')) || (context && context.slug) || getLocalContext().slug;
        if (!slug) {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.vibeOrigText || 'Отправить'; }
          return;
        }

        // Save to queue first as safety net
        enqueue(slug, json);

        postForm(slug, json, 1)
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result.success) {
            // Remove from queue on success
            var queue = loadQueue();
            var jsonStr = JSON.stringify(json);
            queue = queue.filter(function (item) {
              return !(item.slug === slug && JSON.stringify(item.data) === jsonStr);
            });
            saveQueue(queue);

            sendMetrikaGoal(detectFormName(form));
            var redirect = form.getAttribute('data-vibe-redirect');
            if (redirect) { location.href = redirect; return; }
            var msg = form.getAttribute('data-vibe-success') || 'Заявка отправлена!';
            var div = document.createElement('div');
            div.className = 'vibe-form-success';
            div.style.cssText = 'padding:20px;text-align:center;color:#059669;font-size:16px;font-weight:600;';
            div.textContent = msg;
            form.replaceWith(div);
          } else {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset.vibeOrigText || 'Отправить'; }
          }
        })
        .catch(function () {
          // Already in queue, will retry on next page load
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.vibeOrigText || 'Отправить'; }
        });
      });
    });
  }

  function init() {
    // Resolve slug/counter early so submit handlers don't race page navigation on custom domains.
    ensureSiteContext();
    if (autoMode) {
      initAuto();
    }
    initManual();
    // Flush any queued submissions from previous failed attempts
    flushQueue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
