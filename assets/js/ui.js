/* =============================================================================
 * ui.js — Helpers de interface (DOM, formatação, toast, modal)
 * ========================================================================== */
window.EP = window.EP || {};

EP.ui = (function () {
  /* ---- Seletores / criação de elementos -------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // el('div.card#id', {attrs}, [children|string])
  function el(tag, attrs, children) {
    var parts = tag.split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    parts.slice(1).forEach(function (p) {
      if (p[0] === '.') node.classList.add(p.slice(1));
      else if (p[0] === '#') node.id = p.slice(1);
    });
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className += ' ' + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') node.value = v;
      else node.setAttribute(k, v);
    });
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    });
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* ---- Escape de HTML --------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- Formatação ------------------------------------------------------- */
  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDateShort(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('pt-BR');
  }
  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'agora há pouco';
    var m = Math.floor(s / 60); if (m < 60) return 'há ' + m + ' min';
    var h = Math.floor(m / 60); if (h < 24) return 'há ' + h + ' h';
    var d = Math.floor(h / 24); if (d < 30) return 'há ' + d + ' dia' + (d > 1 ? 's' : '');
    return fmtDateShort(ts);
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* ---- Cor determinística a partir de string (avatares) ---------------- */
  function colorFrom(str) {
    var h = 0; str = String(str || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }

  /* ---- Toast ------------------------------------------------------------ */
  function toast(msg, type) {
    var wrap = $('#toast-wrap');
    if (!wrap) { wrap = el('div#toast-wrap'); document.body.appendChild(wrap); }
    var t = el('div.toast', { class: 'toast--' + (type || 'info') }, msg);
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('toast--in'); }, 10);
    setTimeout(function () {
      t.classList.remove('toast--in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 3200);
  }

  /* ---- Modal ------------------------------------------------------------ */
  function modal(opts) {
    opts = opts || {};
    var overlay = el('div.modal-overlay');
    var box = el('div.modal');
    var head = el('div.modal__head', {}, [
      el('h3.modal__title', { text: opts.title || '' }),
      el('button.modal__close', { html: '&times;', onClick: close }),
    ]);
    var body = el('div.modal__body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    box.appendChild(head); box.appendChild(body);

    if (opts.actions) {
      var foot = el('div.modal__foot');
      opts.actions.forEach(function (a) {
        foot.appendChild(el('button.btn', {
          class: a.kind ? 'btn--' + a.kind : 'btn--ghost',
          onClick: function () { if (!a.onClick || a.onClick() !== false) close(); },
          text: a.label,
        }));
      });
      box.appendChild(foot);
    }

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay && opts.dismissable !== false) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('modal-overlay--in'); });

    function close() {
      overlay.classList.remove('modal-overlay--in');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 220);
    }
    return { close: close, body: body };
  }

  function confirm(message, onYes, opts) {
    opts = opts || {};
    modal({
      title: opts.title || 'Confirmar',
      body: el('p', { text: message }),
      actions: [
        { label: opts.cancelLabel || 'Cancelar', kind: 'ghost' },
        { label: opts.yesLabel || 'Confirmar', kind: opts.danger ? 'danger' : 'primary', onClick: onYes },
      ],
    });
  }

  /* ---- Pequenos componentes inline ------------------------------------- */
  function avatar(name, size, color) {
    size = size || 40;
    return el('span.avatar', {
      style: { width: size + 'px', height: size + 'px', background: color || colorFrom(name), fontSize: (size / 2.4) + 'px' },
      text: initials(name),
    });
  }

  function chip(text, opts) {
    opts = opts || {};
    return el('span.chip', { class: opts.active ? 'chip--active' : '', style: opts.color ? { borderColor: opts.color, color: opts.color } : null, text: text });
  }

  function badge(text, color) {
    return el('span.badge', { style: { background: (color || '#888') + '22', color: color || '#555', borderColor: (color || '#888') + '55' }, text: text });
  }

  /* ---- Upload de imagem (redimensiona p/ DataURL leve) ----------------- */
  function readImageFile(file, maxDim, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height, scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        try { cb(cv.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }
  function pickImage(cb, opts) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = function () {
      var f = input.files && input.files[0]; if (!f) return;
      if (f.size > 12 * 1024 * 1024) { toast('Imagem muito grande (máx. 12MB).', 'danger'); return; }
      readImageFile(f, opts.maxDim || 1000, function (data) { if (data) cb(data); else toast('Não foi possível ler a imagem.', 'danger'); });
    };
    input.click();
  }

  /* ---- Ícones SVG (traço, herdam a cor) -------------------------------- */
  var ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    heart: 'M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 10-7.8 7.8L12 21l8.8-7.6a5.5 5.5 0 000-7.8z',
    building: 'M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M9 7h2M9 11h2M9 15h2M15 11h4v10',
    truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    plus: 'M12 5v14M5 12h14',
    check: 'M20 6L9 17l-5-5',
    gift: 'M20 12v9H4v-9M22 7H2v5h20zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
    leaf: 'M11 20A7 7 0 019.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.18 2 8a7 7 0 01-7 7H11zM2 21c0-3 1.85-5.36 5.08-6',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    chart: 'M3 3v18h18M7 16l4-5 3 3 5-7',
    image: 'M3 3h18v18H3zM8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
    video: 'M23 7l-7 5 7 5V7zM1 5h14a2 2 0 012 2v10a2 2 0 01-2 2H1z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z',
    award: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.2 13.9L7 22l5-3 5 3-1.2-8.1',
    briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
    x: 'M18 6L6 18M6 6l12 12',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
    camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
    handshake: 'M2 12l4-4 4 2 4-2 4 2 4-2M2 12l5 5a2 2 0 003 0l2-2 2 2a2 2 0 003 0l5-5',
    arrow: 'M5 12h14M12 5l7 7-7 7',
  };
  function icon(name, size, cls) {
    var d = ICONS[name] || ICONS.check;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size || 20); svg.setAttribute('height', size || 20);
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); svg.appendChild(p);
    return svg;
  }

  return {
    $: $, $$: $$, el: el, clear: clear, esc: esc, appendChildren: appendChildren,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, timeAgo: timeAgo, initials: initials,
    colorFrom: colorFrom, toast: toast, modal: modal, confirm: confirm,
    avatar: avatar, chip: chip, badge: badge, pickImage: pickImage, icon: icon,
  };
})();
