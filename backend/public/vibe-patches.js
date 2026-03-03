/**
 * vibe-patches.js — VibeHosting Visual Patches Runtime
 * Применяет визуальные патчи (текст, картинки, скрытие, стили) на пользовательских сайтах.
 * Подключается автоматически: <script src="https://hostingvibe.ru/api/vibe-patches.js" data-slug="mysite"></script>
 */
(function () {
  'use strict';

  var scriptTag = document.currentScript;
  var slug = '';

  if (scriptTag && scriptTag.getAttribute('data-slug')) {
    slug = scriptTag.getAttribute('data-slug');
  } else {
    var match = location.hostname.match(/^([a-z0-9_-]+)\.hostingvibe\.ru$/i);
    if (match) slug = match[1];
  }

  if (!slug) return;

  var API = 'https://hostingvibe.ru/api/patches/' + slug;
  var patches = [];
  var applied = new Map(); // selector:type -> { original }

  // Простая санитизация HTML — убираем опасные теги и атрибуты
  function sanitizeHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var dangerous = tmp.querySelectorAll('script,iframe,object,embed,form');
    for (var i = 0; i < dangerous.length; i++) {
      dangerous[i].remove();
    }
    // Убираем on* атрибуты
    var all = tmp.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var attrs = all[j].attributes;
      for (var k = attrs.length - 1; k >= 0; k--) {
        if (attrs[k].name.toLowerCase().indexOf('on') === 0) {
          all[j].removeAttribute(attrs[k].name);
        }
      }
    }
    return tmp.innerHTML;
  }

  function applyPatch(patch) {
    var el = document.querySelector(patch.selector);
    if (!el) return false;

    var key = patch.selector + ':' + patch.type;

    if (patch.type === 'text') {
      if (!applied.has(key)) {
        applied.set(key, { original: el.innerHTML });
      }
      el.innerHTML = sanitizeHtml(patch.content);
    } else if (patch.type === 'image') {
      if (!applied.has(key)) {
        applied.set(key, { original: el.src });
      }
      el.src = patch.content;
      if (el.srcset) el.srcset = '';
    } else if (patch.type === 'hide') {
      if (!applied.has(key)) {
        applied.set(key, { original: el.getAttribute('style') || '' });
      }
      el.setAttribute('data-vibe-hidden', '1');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('width', '0', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    } else if (patch.type === 'style') {
      if (!applied.has(key)) {
        applied.set(key, { original: el.getAttribute('style') || '' });
      }
      try {
        var styles = JSON.parse(patch.content);
        for (var prop in styles) {
          if (styles.hasOwnProperty(prop)) {
            el.style[prop] = styles[prop];
          }
        }
      } catch (e) { /* невалидный JSON — пропускаем */ }
    }

    return true;
  }

  function applyAll() {
    for (var i = 0; i < patches.length; i++) {
      applyPatch(patches[i]);
    }
  }

  // Fetch и применить
  fetch(API)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data) || data.length === 0) return;
      patches = data;

      // Применяем сразу
      applyAll();

      // MutationObserver для SPA (React/Vue рендерят асинхронно)
      var debounceTimer;
      var observer = new MutationObserver(function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyAll, 50);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    })
    .catch(function () {
      // Тихо — не ломаем сайт
    });

  // Дополнительное применение при полной загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (patches.length > 0) applyAll();
    });
  }
  window.addEventListener('load', function () {
    if (patches.length > 0) applyAll();
  });
})();
