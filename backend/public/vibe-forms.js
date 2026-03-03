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

  var API = 'https://hostingvibe.ru/api/forms/';
  var script = document.currentScript;
  var autoMode = script && script.hasAttribute('data-vibe-auto');
  var globalSlug = script && script.getAttribute('data-slug');
  var metrikaId = script && script.getAttribute('data-metrika-id');

  // Яндекс.Метрика: отправить цель при отправке формы
  function sendMetrikaGoal(formName) {
    if (metrikaId && window.ym) {
      try {
        window.ym(Number(metrikaId), 'reachGoal', 'form_submit', { form_name: formName || 'unknown' });
      } catch (e) { /* ignore */ }
    }
  }

  function getSlug() {
    if (globalSlug) return globalSlug;
    var host = location.hostname;
    var match = host.match(/^([a-z0-9-]+)\.hostingvibe\.ru$/);
    if (match) return match[1];
    var meta = document.querySelector('meta[name="vibe-slug"]');
    if (meta) return meta.getAttribute('content');
    return null;
  }

  // Определяем имя формы по контексту
  function detectFormName(form) {
    // 1. Явно указано через data-vibe-form-name
    var explicit = form.getAttribute('data-vibe-form-name');
    if (explicit) return explicit;

    // 2. По id или name формы
    if (form.id) return form.id;
    if (form.name) return form.name;

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

  function sendData(form) {
    var slug = form.getAttribute('data-vibe-slug') || getSlug();
    if (!slug) return;

    var data = new FormData(form);
    var json = {};
    data.forEach(function (value, key) {
      json[key] = value;
    });

    // Добавляем имя формы
    json['_vibe_form_name'] = detectFormName(form);

    // Тихо отправляем — не мешаем сайту
    fetch(API + slug, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'VibeForm',
      },
      body: JSON.stringify(json),
    }).catch(function () {});
  }

  function initAuto() {
    // Перехватываем submit на всех формах через capture phase
    // Это срабатывает ДО обработчиков сайта — мы просто копируем данные
    document.addEventListener('submit', function (e) {
      if (e.target && e.target.tagName === 'FORM') {
        sendData(e.target);
        sendMetrikaGoal(detectFormName(e.target));
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
      var slug = form.getAttribute('data-vibe-slug') || getSlug();
      if (!slug) return;

      var btn = form.querySelector('[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.dataset.vibeOrigText = btn.textContent;
        btn.textContent = 'Отправка...';
      }

      var data = new FormData(form);
      var json = {};
      data.forEach(function (value, key) {
        json[key] = value;
      });

      json['_vibe_form_name'] = detectFormName(form);

      fetch(API + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'VibeForm' },
        body: JSON.stringify(json),
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result.success) {
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
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.vibeOrigText || 'Отправить'; }
        });
    });
  }

  function init() {
    if (autoMode) {
      initAuto();
    }
    initManual();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
