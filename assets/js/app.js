/* =============================================================================
 * app.js — Roteador (hash), cabeçalho e inicialização
 * ========================================================================== */
window.EP = window.EP || {};

EP.app = (function () {
  var el = EP.ui.el;
  var viewRoot, headerRoot;
  var cleanups = [];

  /* ---- Gestão de limpeza (intervals, GPS, listeners) ------------------- */
  function onCleanup(fn) { if (typeof fn === 'function') cleanups.push(fn); }
  function runCleanups() {
    cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
    cleanups = [];
  }

  /* ---- Navegação -------------------------------------------------------- */
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function parseRoute() {
    var raw = location.hash.replace(/^#\/?/, '');
    var qIdx = raw.indexOf('?');
    var query = {};
    if (qIdx >= 0) {
      raw.slice(qIdx + 1).split('&').forEach(function (kv) {
        var p = kv.split('='); if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      raw = raw.slice(0, qIdx);
    }
    var parts = raw.split('/').filter(function (x) { return x.length; });
    return { path: parts[0] || '', parts: parts, query: query, full: location.hash };
  }

  var ROUTES = {
    '': EP.views.home,
    'organizacoes': EP.views.orgsList,
    'org': EP.views.orgDetail,
    'doar': EP.views.donate,
    'doacao': EP.views.donationDetail,
    'entrar': EP.views.login,
    'cadastro': EP.views.register,
    'painel': EP.views.dashboard,
    'impacto': EP.views.feed,
    'privacidade': EP.views.privacy,
    'termos': EP.views.terms,
    'meus-dados': EP.views.myData,
  };

  /* ---- Render principal ------------------------------------------------- */
  function render() {
    runCleanups();
    var route = parseRoute();
    var view = ROUTES[route.path] || EP.views.notFound;
    var node;
    try { node = view(route); }
    catch (e) {
      console.error(e);
      node = el('div.page', {}, [el('div.error-box', {}, [el('h2', { text: 'Erro ao renderizar' }), el('pre', { text: (e && e.message) || String(e) })])]);
    }
    EP.ui.clear(viewRoot);
    viewRoot.appendChild(node);
    renderHeader();
    setActiveNav(route.path);
    window.scrollTo(0, 0);
  }

  /* ---- Cabeçalho -------------------------------------------------------- */
  function renderHeader() {
    EP.ui.clear(headerRoot);
    var user = EP.auth.currentUser();

    var nav = el('nav.nav', {}, [
      navLink('#/', '🏠 Início'),
      navLink('#/organizacoes', '🏛️ Organizações'),
      navLink('#/impacto', '💚 Impacto'),
    ]);

    var right;
    if (user) {
      right = el('div.header__right', {}, [
        el('button.btn.btn--sm.btn--primary', { text: '＋ Doar', onClick: function () { go('#/organizacoes'); } }),
        notifBell(user),
        userMenu(user),
      ]);
    } else {
      right = el('div.header__right', {}, [
        el('a.btn.btn--sm.btn--ghost', { href: '#/entrar', text: 'Entrar' }),
        el('a.btn.btn--sm.btn--primary', { href: '#/cadastro', text: 'Criar conta' }),
      ]);
    }

    headerRoot.appendChild(el('div.header__inner', {}, [
      el('a.brand', { href: '#/', }, [
        el('span.brand__logo', { text: EP.config.app.emoji }),
        el('span.brand__name', { text: EP.config.app.name }),
      ]),
      nav,
      right,
      adminMenu(),
    ]));
  }

  function navLink(href, label) {
    return el('a.nav__link', { href: href, 'data-path': href, text: label });
  }

  function setActiveNav(path) {
    EP.ui.$$('.nav__link').forEach(function (a) {
      var target = a.getAttribute('href').replace(/^#\/?/, '').split('?')[0];
      a.classList.toggle('nav__link--active', target === path);
    });
  }

  /* ---- Sininho de notificações ----------------------------------------- */
  function notifBell(user) {
    var list = el('div.menu.menu--right.notif-menu', { class: 'menu--hidden' });
    var count = EP.logic.unreadCount(user.id);
    var badge = el('span.notif-badge', { id: 'notif-badge', class: count ? '' : 'notif-badge--hidden', text: String(count) });
    var btn = el('button.icon-btn.notif-btn', { title: 'Notificações', onClick: function (e) {
      e.stopPropagation();
      var willOpen = list.classList.contains('menu--hidden');
      if (willOpen) { buildNotifList(list, user); }
      list.classList.toggle('menu--hidden');
      if (willOpen) EP.logic.markAllRead(user.id); // zera o contador ao abrir
    } }, ['🔔', badge]);
    document.addEventListener('click', function () { list.classList.add('menu--hidden'); });
    return el('div.menu-wrap', {}, [btn, list]);
  }

  function buildNotifList(container, user) {
    EP.ui.clear(container);
    container.appendChild(el('div.menu__title', { text: 'Notificações' }));
    var items = EP.logic.notificationsFor(user.id).slice(0, 15);
    if (!items.length) { container.appendChild(el('div.notif-empty.muted', { text: 'Você está em dia! Sem notificações.' })); return; }
    items.forEach(function (n) {
      container.appendChild(el('a.notif-item', { class: n.read ? '' : 'notif-item--unread', href: n.link || '#/', onClick: function () { container.classList.add('menu--hidden'); } }, [
        el('span.notif-item__icon', { text: n.icon || '🔔' }),
        el('div.notif-item__body', {}, [
          el('div.notif-item__text', { text: n.text }),
          el('div.notif-item__time.muted.tiny', { text: EP.ui.timeAgo(n.createdAt) }),
        ]),
      ]));
    });
  }

  function refreshBell() {
    var b = EP.ui.$('#notif-badge'); if (!b) return;
    var u = EP.auth.currentUser();
    var c = u ? EP.logic.unreadCount(u.id) : 0;
    b.textContent = String(c);
    b.classList.toggle('notif-badge--hidden', !c);
  }

  function userMenu(user) {
    var menu = el('div.menu', { class: 'menu--hidden' }, [
      el('a.menu__item', { href: '#/painel', text: '📊 Meu painel' }),
      el('a.menu__item', { href: '#/meus-dados', text: '🗂️ Meus dados (LGPD)' }),
      el('div.menu__sep'),
      el('button.menu__item', { text: '🚪 Sair', onClick: function () { EP.auth.logout(); go('#/'); EP.ui.toast('Você saiu da conta.', 'info'); } }),
    ]);
    var btn = el('button.user-btn', { onClick: function (e) { e.stopPropagation(); menu.classList.toggle('menu--hidden'); } }, [
      EP.ui.avatar(user.name, 34), el('span.user-btn__name', { text: user.name.split(' ')[0] }), el('span', { text: '▾' }),
    ]);
    document.addEventListener('click', function () { menu.classList.add('menu--hidden'); });
    return el('div.menu-wrap', {}, [btn, menu]);
  }

  function adminMenu() {
    var menu = el('div.menu.menu--right', { class: 'menu--hidden' }, [
      el('div.menu__title', { text: 'Ferramentas (demo)' }),
      el('button.menu__item', { text: '🔄 Recarregar dados de exemplo', onClick: function () {
        EP.ui.confirm('Isso apaga os dados atuais e recria os exemplos. Continuar?', async function () {
          EP.auth.logout();
          if (EP.db.supaMode()) {
            overlay('<div class="boot-spinner"></div><h3>Recriando dados no Supabase…</h3>');
            try { await EP.supa.reseed(); hideOverlay(); go('#/'); render(); EP.ui.toast('Dados de exemplo recarregados.', 'success'); }
            catch (e) { hideOverlay(); EP.ui.toast('Falha ao recriar: ' + (e.message || e), 'danger'); }
          } else { EP.db.reset(true); go('#/'); EP.ui.toast('Dados de exemplo recarregados.', 'success'); }
        }, { danger: true, yesLabel: 'Resetar' });
      } }),
      el('button.menu__item', { text: '🗑️ Limpar tudo (zerar)', onClick: function () {
        EP.ui.confirm('Apagar TODOS os dados (sem recriar exemplos)?', async function () {
          EP.auth.logout();
          if (EP.db.supaMode()) {
            overlay('<div class="boot-spinner"></div><h3>Limpando…</h3>');
            try { await EP.supa.clearData(); hideOverlay(); go('#/'); render(); EP.ui.toast('Banco zerado.', 'info'); }
            catch (e) { hideOverlay(); EP.ui.toast('Falha: ' + (e.message || e), 'danger'); }
          } else { EP.db.reset(false); go('#/'); EP.ui.toast('Banco zerado.', 'info'); }
        }, { danger: true, yesLabel: 'Apagar' });
      } }),
      el('div.menu__sep'),
      el('a.menu__item', { href: '#/impacto', text: 'ℹ️ Senha demo: ' + EP.config.demoPassword }),
    ]);
    var btn = el('button.icon-btn', { title: 'Ferramentas', onClick: function (e) { e.stopPropagation(); menu.classList.toggle('menu--hidden'); }, text: '⚙️' });
    document.addEventListener('click', function () { menu.classList.add('menu--hidden'); });
    return el('div.menu-wrap', {}, [btn, menu]);
  }

  /* ---- Boot ------------------------------------------------------------- */
  var liveBusy = false;                 // pausa o re-render remoto durante simulação/GPS
  function setLiveBusy(v) { liveBusy = !!v; }

  function overlay(html) {
    var ov = EP.ui.$('#boot-overlay');
    if (!ov) { ov = el('div#boot-overlay.boot-overlay'); document.body.appendChild(ov); }
    EP.ui.clear(ov); ov.appendChild(el('div.boot-overlay__box', { html: html }));
    return ov;
  }
  function hideOverlay() { var ov = EP.ui.$('#boot-overlay'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
  function ready() { console.log('%c' + EP.config.app.name + ' pronto (' + (EP.db.supaMode() ? 'Supabase' : 'local') + ').', 'color:#0e7c66;font-weight:bold'); }

  function boot() {
    headerRoot = EP.ui.$('#header');
    viewRoot = EP.ui.$('#view');
    window.addEventListener('hashchange', render);
    EP.bus.on('auth:changed', function () { EP.auth.refresh(); renderHeader(); });
    EP.bus.on('notif:changed', refreshBell);   // contador do sininho ao vivo
    if (!location.hash) location.hash = '#/';

    if (EP.db.supaMode()) bootSupabase();
    else { EP.db.load(); render(); ready(); EP.chatbot && EP.chatbot.mount(); }
  }

  async function bootSupabase() {
    overlay('<div class="boot-spinner"></div><h3>Conectando ao Supabase…</h3><p class="muted">Carregando dados do servidor.</p>');
    try {
      var r = await EP.supa.init();
      EP.db.setState(r.state);
      EP.auth.refresh();
      setupRealtime();
      hideOverlay();
      render(); ready();
      EP.chatbot && EP.chatbot.mount();
      if (r.seeded) EP.ui.toast('Banco criado no Supabase com dados de exemplo. 🎉', 'success');
    } catch (e) {
      console.error(e);
      var msg = (e && (e.message || e.code)) ? (e.message || e.code) : String(e);
      var missing = /PGRST|schema cache|does not exist|Could not find the table|relation .* does not exist/i.test(msg);
      if (missing) {
        overlay('<h3>⚠️ Falta criar as tabelas</h3>'
          + '<p>Rode o script <code>supabase/schema.sql</code> no <b>SQL Editor</b> do seu projeto Supabase e recarregue.</p>'
          + '<button class="btn btn--primary" onclick="location.reload()">Já rodei — recarregar</button>'
          + '<p class="muted tiny" style="margin-top:12px">Para usar offline: em <code>assets/js/config.js</code> mude <code>backend.mode</code> para <code>\'local\'</code>.</p>');
      } else {
        overlay('<h3>Não foi possível conectar ao Supabase</h3><p class="muted">' + EP.ui.esc(msg) + '</p>'
          + '<button class="btn btn--primary" onclick="location.reload()">Tentar de novo</button>');
      }
    }
  }

  var remoteTimer = null;
  function setupRealtime() {
    EP.supa.subscribe(function (coll, payload) {
      if (EP.supa.isMuted && EP.supa.isMuted()) return;   // ignora ecos durante reseed/limpeza
      var newRow = payload['new'] && payload['new'].doc;
      var oldId = payload['old'] && payload['old'].id;
      if (payload.eventType === 'DELETE') EP.db.mergeRemote(coll, 'delete', { id: oldId });
      else if (newRow) EP.db.mergeRemote(coll, 'upsert', newRow);

      // espelha eventos para a UI ao vivo (mapas, sininho) — agora entre dispositivos
      if (coll === 'deliveries' && newRow) {
        if (newRow.delivererLocation) EP.bus.emit('delivery:moved', { deliveryId: newRow.id, lat: newRow.delivererLocation.lat, lng: newRow.delivererLocation.lng, at: newRow.delivererLocation.at });
        EP.bus.emit('delivery:changed', { deliveryId: newRow.id });
      }
      if (coll === 'notifications') EP.bus.emit('notif:changed', {});
      if (coll === 'donations' && newRow) EP.bus.emit('donation:changed', { donationId: newRow.id });

      // re-render leve para listas (pausado durante simulação/GPS local)
      if (!liveBusy) { clearTimeout(remoteTimer); remoteTimer = setTimeout(render, 400); }
    });
  }

  return { boot: boot, go: go, render: render, onCleanup: onCleanup, parseRoute: parseRoute, setLiveBusy: setLiveBusy };
})();

document.addEventListener('DOMContentLoaded', EP.app.boot);
