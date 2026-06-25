/**
 * vibe-editor-bridge.js — VibeHosting Visual Editor Bridge
 * Работает ТОЛЬКО внутри iframe при редактировании.
 * Коммуникация с parent через postMessage.
 */
(function () {
  'use strict';

  var PARENT_ORIGIN = 'https://hostingvibe.ru';
  var IGNORE_TAGS = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'BR'];
  var hoveredEl = null;
  var selectedEl = null;
  var overlay = null;
  var originals = new Map(); // element -> { innerHTML, src, style }

  // Создаём overlay для подсветки (absolute чтобы учитывать скролл)
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'vibe-bridge-overlay';
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:999999;border:2px dashed #10b981;background:rgba(16,185,129,0.08);transition:all 0.1s ease;display:none;';
    document.body.appendChild(overlay);
  }

  function positionOverlay(el) {
    if (!el || !overlay) return;
    var rect = el.getBoundingClientRect();
    var scrollX = window.scrollX || window.pageXOffset;
    var scrollY = window.scrollY || window.pageYOffset;
    overlay.style.top = (rect.top + scrollY) + 'px';
    overlay.style.left = (rect.left + scrollX) + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  // Генерация CSS-селектора (приоритет: id > data-* > уникальные классы > nth-of-type)
  function generateSelector(el) {
    // Приоритет 1: ID
    if (el.id) {
      return '#' + CSS.escape(el.id);
    }

    // Приоритет 2: data-* атрибут (если уникален)
    var dataAttrs = el.dataset ? Object.keys(el.dataset) : [];
    for (var d = 0; d < dataAttrs.length; d++) {
      var attrName = dataAttrs[d];
      // Пропускаем служебные vibe-атрибуты
      if (attrName.indexOf('vibe') === 0) continue;
      var attrVal = el.dataset[attrName];
      // Конвертируем camelCase обратно в kebab-case для CSS-селектора
      var cssAttr = 'data-' + attrName.replace(/([A-Z])/g, '-$1').toLowerCase();
      var selector = '[' + cssAttr + '="' + CSS.escape(attrVal) + '"]';
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Приоритет 3: уникальная комбинация классов (не utility-классы)
    if (el.classList && el.classList.length > 0 && el.classList.length <= 4) {
      var classes = Array.from(el.classList).filter(function (c) {
        // Пропускаем Tailwind utility классы (содержат :, /, или слишком короткие)
        return c.length > 2 && c.indexOf(':') === -1 && c.indexOf('/') === -1;
      });
      if (classes.length > 0 && classes.length <= 3) {
        var classSel = classes.map(function (c) { return '.' + CSS.escape(c); }).join('');
        if (document.querySelectorAll(classSel).length === 1) {
          return classSel;
        }
        // Попробуем tag + classes
        var tagClassSel = el.tagName.toLowerCase() + classSel;
        if (document.querySelectorAll(tagClassSel).length === 1) {
          return tagClassSel;
        }
      }
    }

    // Приоритет 4: nth-of-type path от body
    var path = [];
    var current = el;

    while (current && current !== document.body && current !== document.documentElement) {
      var parent = current.parentElement;
      if (!parent) break;

      var tag = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift('#' + CSS.escape(current.id));
        break;
      }

      var siblings = Array.from(parent.children).filter(function (s) {
        return s.tagName === current.tagName;
      });

      if (siblings.length === 1) {
        path.unshift(tag);
      } else {
        var index = siblings.indexOf(current) + 1;
        path.unshift(tag + ':nth-of-type(' + index + ')');
      }

      current = parent;
    }

    if (path.length === 0) return null;

    if (path[0].charAt(0) !== '#') {
      path.unshift('body');
    }

    return path.join(' > ');
  }

  function isEditable(el) {
    if (!el || !el.tagName) return false;
    if (IGNORE_TAGS.includes(el.tagName)) return false;
    if (el.id === 'vibe-bridge-overlay') return false;
    if (el.closest && el.closest('svg') && el.tagName !== 'SVG') return false;
    return true;
  }

  function getElementType(el) {
    var tag = el.tagName;
    if (tag === 'IMG' || (tag === 'SOURCE' && el.closest('picture'))) return 'image';
    if (tag === 'VIDEO' || tag === 'IFRAME') return 'media';
    return 'text';
  }

  // Hover
  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    if (!isEditable(el)) return;
    hoveredEl = el;
    positionOverlay(el);
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (e.target === hoveredEl) {
      hoveredEl = null;
      if (!selectedEl) hideOverlay();
    }
  }, true);

  // Click — выбор элемента
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!isEditable(el)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    selectedEl = el;
    var selector = generateSelector(el);
    if (!selector) return;

    var rect = el.getBoundingClientRect();
    var type = getElementType(el);

    // Подсветка выбранного
    positionOverlay(el);
    if (overlay) {
      overlay.style.borderStyle = 'solid';
      overlay.style.borderColor = '#10b981';
      overlay.style.background = 'rgba(16,185,129,0.12)';
    }

    window.parent.postMessage({
      type: 'vibe-bridge:select',
      selector: selector,
      tag: el.tagName.toLowerCase(),
      elementType: type,
      text: type === 'text' ? el.innerHTML : '',
      src: type === 'image' ? (el.src || el.getAttribute('src') || '') : '',
      computedStyles: getComputedStyleSubset(el),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    }, PARENT_ORIGIN);
  }, true);

  // Получить подмножество computed styles для style-editor
  function getComputedStyleSubset(el) {
    var cs = window.getComputedStyle(el);
    return {
      color: cs.color,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      textAlign: cs.textAlign,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textDecoration: cs.textDecoration,
      backgroundColor: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      opacity: cs.opacity,
      padding: cs.padding,
      margin: cs.margin,
    };
  }

  // Слушаем команды от parent
  window.addEventListener('message', function (e) {
    if (e.origin !== PARENT_ORIGIN) return;
    var data = e.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'vibe-bridge:init') {
      createOverlay();
      window.parent.postMessage({ type: 'vibe-bridge:ready' }, PARENT_ORIGIN);
      return;
    }

    if (data.type === 'vibe-bridge:preview') {
      var el = document.querySelector(data.selector);
      if (!el) return;

      // Сохраняем оригинал
      if (!originals.has(el)) {
        originals.set(el, {
          innerHTML: el.innerHTML,
          src: el.src,
          style: el.getAttribute('style') || '',
        });
      }

      if (data.patchType === 'text') {
        el.innerHTML = data.content;
      } else if (data.patchType === 'image') {
        el.src = data.content;
        if (el.srcset) el.srcset = '';
      } else if (data.patchType === 'hide') {
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('position', 'absolute', 'important');
        el.style.setProperty('width', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
      } else if (data.patchType === 'style') {
        try {
          var styles = JSON.parse(data.content);
          for (var prop in styles) {
            if (styles.hasOwnProperty(prop)) {
              el.style[prop] = styles[prop];
            }
          }
        } catch (ex) { /* */ }
      }
      return;
    }

    if (data.type === 'vibe-bridge:reset') {
      if (data.selector) {
        var el = document.querySelector(data.selector);
        if (el && originals.has(el)) {
          var orig = originals.get(el);
          el.innerHTML = orig.innerHTML;
          if (orig.src !== undefined) el.src = orig.src;
          el.setAttribute('style', orig.style);
          originals.delete(el);
        }
      } else {
        originals.forEach(function (orig, el) {
          el.innerHTML = orig.innerHTML;
          if (orig.src !== undefined) el.src = orig.src;
          el.setAttribute('style', orig.style);
        });
        originals.clear();
      }
      return;
    }

    if (data.type === 'vibe-bridge:highlight') {
      var el = document.querySelector(data.selector);
      if (el) positionOverlay(el);
      return;
    }

    if (data.type === 'vibe-bridge:deselect') {
      selectedEl = null;
      hideOverlay();
      if (overlay) {
        overlay.style.borderStyle = 'dashed';
      }
      return;
    }
  });

  // Обновлять overlay при скролле
  document.addEventListener('scroll', function () {
    if (selectedEl) positionOverlay(selectedEl);
    else if (hoveredEl) positionOverlay(hoveredEl);
  }, true);
  window.addEventListener('resize', function () {
    if (selectedEl) positionOverlay(selectedEl);
  });

  // Блокируем навигацию внутри iframe
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  window.open = function () { return null; };

  // Перехват ссылок
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (a && a.href) {
      e.preventDefault();
    }
  }, true);
})();
