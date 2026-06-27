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

  return {
    $: $, $$: $$, el: el, clear: clear, esc: esc, appendChildren: appendChildren,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, timeAgo: timeAgo, initials: initials,
    colorFrom: colorFrom, toast: toast, modal: modal, confirm: confirm,
    avatar: avatar, chip: chip, badge: badge,
  };
})();
