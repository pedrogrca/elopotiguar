/* =============================================================================
 * views.js — Telas (páginas) do aplicativo
 * Cada função retorna um nó DOM montado pelo roteador (app.js) em #view.
 * ========================================================================== */
window.EP = window.EP || {};

EP.views = (function () {
  var el = EP.ui.el, C = EP.components, cfg = EP.config;

  /* ---------------------------------------------------------------------- */
  /* Helpers de layout e formulário                                          */
  /* ---------------------------------------------------------------------- */
  function page(opts, children) {
    return el('div.page', {}, [
      el('div.page__head', {}, [
        opts.title ? el('h1.page__title', { text: opts.title }) : null,
        opts.subtitle ? el('p.page__subtitle.muted', { text: opts.subtitle }) : null,
        opts.actions ? el('div.page__actions', {}, opts.actions) : null,
      ]),
      el('div.page__body', {}, children),
    ]);
  }

  function field(label, input, hint) {
    return el('label.field', {}, [
      el('span.field__label', { text: label }),
      input,
      hint ? el('span.field__hint.muted', { text: hint }) : null,
    ]);
  }

  function input(attrs) { return el('input.input', attrs || {}); }
  function textarea(attrs) { return el('textarea.input', Object.assign({ rows: 3 }, attrs || {})); }
  function select(options, value) {
    var s = el('select.input');
    options.forEach(function (o) {
      var val = typeof o === 'string' ? o : o.value;
      var lab = typeof o === 'string' ? o : o.label;
      var opt = el('option', { value: val, text: lab });
      if (val === value) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  function multiChips(options, selected) {
    selected = (selected || []).slice();
    var wrap = el('div.chips');
    options.forEach(function (o) {
      var c = EP.ui.chip(o, { active: selected.indexOf(o) >= 0 });
      c.style.cursor = 'pointer';
      c.addEventListener('click', function () {
        var i = selected.indexOf(o);
        if (i >= 0) { selected.splice(i, 1); c.classList.remove('chip--active'); }
        else { selected.push(o); c.classList.add('chip--active'); }
      });
      wrap.appendChild(c);
    });
    wrap.getValue = function () { return selected.slice(); };
    return wrap;
  }

  function requireLogin(action) {
    if (!EP.auth.isLoggedIn()) {
      EP.ui.toast('Faça login para ' + (action || 'continuar') + '.', 'info');
      EP.app.go('#/entrar');
      return false;
    }
    return true;
  }

  /* ====================================================================== */
  /* HOME                                                                    */
  /* ====================================================================== */
  function home() {
    var stats = EP.logic.globalStats();
    var prioritized = EP.logic.prioritizedOrgs().slice(0, 3);
    var ranking = EP.logic.orgRanking().slice(0, 5);
    var posts = EP.logic.feed().slice(0, 2);

    var hero = el('section.hero', {}, [
      el('div.hero__content', {}, [
        el('div.hero__badge', { text: cfg.app.emoji + ' ' + cfg.app.region }),
        el('h1.hero__title', { text: cfg.app.tagline }),
        el('p.hero__sub', { text: 'Doe, acompanhe cada etapa em tempo real e ajude com suas habilidades. Transparência do início ao fim.' }),
        el('div.hero__cta', {}, [
          el('button.btn.btn--primary.btn--lg', { text: '💝 Quero doar', onClick: function () { EP.app.go('#/organizacoes'); } }),
          el('button.btn.btn--ghost.btn--lg', { text: '🙋 Quero me voluntariar', onClick: function () { EP.app.go(EP.auth.isLoggedIn() ? '#/painel' : '#/cadastro'); } }),
        ]),
      ]),
      el('div.hero__stats', {}, [
        C.statCard(stats.orgs, 'Organizações', '🏛️'),
        C.statCard(stats.donations, 'Doações', '📦'),
        C.statCard(stats.completed, 'Ciclos concluídos', '✅'),
        C.statCard(stats.volunteers, 'Voluntários', '🙋'),
      ]),
    ]);

    var priSection = el('section.section', {}, [
      el('div.section__head', {}, [
        el('h2', { text: '🚨 Prioridade: quem mais precisa' }),
        el('a.link', { href: '#/organizacoes', text: 'ver todas →' }),
      ]),
      el('p.muted', { text: 'Organizações em maior situação de vulnerabilidade e com necessidades urgentes aparecem primeiro.' }),
      el('div.grid.grid--3', {}, prioritized.map(function (p) { return C.orgCard(p.org); })),
    ]);

    var rankSection = el('section.section', {}, [
      el('h2', { text: '🏆 Ranking de confiança' }),
      el('p.muted', { text: 'Organizações que comprovam o impacto das doações ganham Pontos de Confiança.' }),
      el('div.ranking', {}, ranking.map(function (o, i) {
        return el('div.ranking__row', { onClick: function () { EP.app.go('#/org/' + o.id); } }, [
          el('span.ranking__pos', { text: '#' + (i + 1) }),
          EP.ui.avatar(o.name, 36),
          el('div.ranking__name', {}, [el('strong', { text: o.name }), o.verified ? el('span.verified', { text: ' ✔' }) : null]),
          C.trustBadge(o),
        ]);
      })),
    ]);

    var feedSection = el('section.section', {}, [
      el('div.section__head', {}, [el('h2', { text: '💚 Impacto recente' }), el('a.link', { href: '#/impacto', text: 'ver feed →' })]),
      el('div.grid.grid--2', {}, posts.map(function (p) { return C.postCard(p); })),
    ]);

    var how = el('section.section.how', {}, [
      el('h2', { text: 'Como funciona' }),
      el('div.grid.grid--4', {}, [
        howCard('1', '💝', 'Doe', 'Escolha uma organização e doe recursos ou seu tempo.'),
        howCard('2', '🛵', 'Acompanhe', 'Veja a entrega ao vivo no mapa e por código de segurança.'),
        howCard('3', '📦', 'Transparência', 'Status Recebido → Em estoque → Usado, etapa por etapa.'),
        howCard('4', '🏆', 'Confiança', 'A organização comprova o impacto e ganha credibilidade.'),
      ]),
    ]);

    return el('div', {}, [hero, priSection, how, rankSection, feedSection]);
  }

  function howCard(n, icon, title, text) {
    return el('div.card.how-card', {}, [
      el('div.how-card__icon', { text: icon }),
      el('div.how-card__step', { text: 'Passo ' + n }),
      el('h3', { text: title }), el('p.muted', { text: text }),
    ]);
  }

  /* ====================================================================== */
  /* LISTA DE ORGANIZAÇÕES                                                   */
  /* ====================================================================== */
  function orgsList(params) {
    var q = (params.query.q || '').toLowerCase();
    var cat = params.query.cat || '';
    var user = EP.auth.currentUser();
    var list = user ? EP.logic.recommendOrgs(user) : EP.logic.prioritizedOrgs();

    var filtered = list.filter(function (p) {
      var o = p.org;
      if (cat && o.category !== cat) return false;
      if (q && (o.name + ' ' + o.description + ' ' + o.city).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    var search = input({ placeholder: '🔎 Buscar organização...', value: params.query.q || '' });
    search.addEventListener('input', function () { EP.app.go('#/organizacoes?q=' + encodeURIComponent(search.value) + (cat ? '&cat=' + encodeURIComponent(cat) : '')); });

    var cats = el('div.chips', {}, [EP.ui.chip('Todas', { active: !cat })].concat(cfg.categories.map(function (c) {
      var chip = EP.ui.chip(c, { active: c === cat }); chip.style.cursor = 'pointer';
      chip.addEventListener('click', function () { EP.app.go('#/organizacoes?cat=' + encodeURIComponent(c === cat ? '' : c)); });
      return chip;
    })));
    cats.firstChild.style.cursor = 'pointer';
    cats.firstChild.addEventListener('click', function () { EP.app.go('#/organizacoes'); });

    return page({ title: 'Organizações', subtitle: 'Priorizadas por vulnerabilidade e urgência' + (user ? ', e pelos seus interesses' : '') + '.' }, [
      el('div.filters', {}, [search, cats]),
      filtered.length ? el('div.grid.grid--3', {}, filtered.map(function (p) { return C.orgCard(p.org); }))
        : el('p.empty', { text: 'Nenhuma organização encontrada.' }),
    ]);
  }

  /* ====================================================================== */
  /* DETALHE DA ORGANIZAÇÃO                                                  */
  /* ====================================================================== */
  function orgDetail(params) {
    var org = EP.db.orgById(params.parts[1]);
    if (!org) return notFound('Organização não encontrada.');
    var needs = EP.db.needsOfOrg(org.id).filter(function (n) { return n.status === 'open'; });
    var posts = EP.db.postsForOrg(org.id).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var tier = EP.logic.trustTier(org.trustPoints || 0);

    var header = el('div.org-header.card', {}, [
      EP.ui.avatar(org.name, 72),
      el('div.org-header__main', {}, [
        el('h1', {}, [el('span', { text: org.name }), org.verified ? el('span.verified', { title: 'Verificada', text: ' ✔' }) : null]),
        el('div.org-header__meta.muted', { text: '🏛️ ' + org.category + ' · 📍 ' + (org.location.address || org.city) }),
        el('p', { text: org.description }),
        el('div.org-header__badges', {}, [
          C.trustBadge(org),
          el('span.muted', {}, [el('span', { text: 'Vulnerabilidade ' }), C.vulnerabilityBar(org.vulnerability)]),
        ]),
      ]),
      el('div.org-header__cta', {}, [
        el('button.btn.btn--primary.btn--lg', { text: '💝 Doar agora', onClick: function () { EP.app.go('#/doar/' + org.id); } }),
      ]),
    ]);

    var needsSection = el('section.section', {}, [
      el('h2', { text: 'Necessidades (' + needs.length + ')' }),
      needs.length ? el('div.grid.grid--2', {}, needs.map(function (n) {
        return C.needCard(n, org, { showDonate: true, showVolunteer: true });
      })) : el('p.muted', { text: 'Sem necessidades abertas no momento.' }),
    ]);

    var tierExplain = el('div.card.tier-card', {}, [
      el('h3', { text: tier.icon + ' Credibilidade: ' + tier.label }),
      el('p.muted', { text: 'Esta organização já acumulou ' + (org.trustPoints || 0) + ' Pontos de Confiança ao comprovar o recebimento e uso das doações.' }),
      el('div.tier-progress', {}, cfg.trustTiers.map(function (t) {
        return el('div.tier-progress__item', { class: (org.trustPoints || 0) >= t.min ? 'is-on' : '', style: { color: t.color } }, [
          el('span', { text: t.icon }), el('span.tiny', { text: t.label }), el('span.tiny.muted', { text: t.min + '+' }),
        ]);
      })),
    ]);

    var postsSection = el('section.section', {}, [
      el('h2', { text: 'Postagens de impacto' }),
      posts.length ? el('div.grid.grid--2', {}, posts.map(function (p) { return C.postCard(p); }))
        : el('p.muted', { text: 'Ainda sem postagens.' }),
    ]);

    return el('div.page', {}, [header, el('div.org-detail-grid', {}, [
      el('div', {}, [needsSection, postsSection]),
      el('div', {}, [tierExplain]),
    ])]);
  }

  /* ====================================================================== */
  /* FORMULÁRIO DE DOAÇÃO                                                    */
  /* ====================================================================== */
  function donate(params) {
    if (!requireLogin('doar')) return el('div');
    var org = EP.db.orgById(params.parts[1]);
    if (!org) return notFound('Organização não encontrada.');
    var preNeed = params.query.need ? EP.db.get('needs', params.query.need) : null;
    var user = EP.auth.currentUser();

    var type = (preNeed && preNeed.type === 'financial') ? 'financial' : 'material';

    var typeSel = el('div.seg', {}, [
      segBtn('📦 Material', type === 'material', function () { type = 'material'; render(); }),
      segBtn('💰 Financeiro', type === 'financial', function () { type = 'financial'; render(); }),
    ]);

    var descIn = input({ placeholder: 'Ex.: 10 cestas básicas', value: preNeed ? preNeed.title : '' });
    var qtyIn = input({ type: 'number', min: '1', value: '1' });
    var amountIn = input({ type: 'number', min: '1', step: '0.01', placeholder: '0,00' });
    var deliveryChk = el('input', { type: 'checkbox' });
    var pickupIn = input({ placeholder: 'Endereço de coleta (onde o entregador busca)', value: (user.location && user.location.city) ? 'Meu endereço, ' + user.location.city : '' });

    var formHost = el('div.form');

    function render() {
      typeSel.replaceWith((typeSel = el('div.seg', {}, [
        segBtn('📦 Material', type === 'material', function () { type = 'material'; render(); }),
        segBtn('💰 Financeiro', type === 'financial', function () { type = 'financial'; render(); }),
      ])));
      EP.ui.clear(formHost);
      if (type === 'material') {
        formHost.appendChild(field('O que você vai doar?', descIn));
        formHost.appendChild(field('Quantidade', qtyIn));
        var delivField = el('div.deliv-opt', {}, [
          el('label.check', {}, [deliveryChk, el('span', { text: ' 🛵 Quero um entregador voluntário (acompanhamento por GPS e código)' })]),
        ]);
        formHost.appendChild(delivField);
        var pickWrap = el('div', {}, [field('Endereço de coleta', pickupIn, 'Necessário para a mediação da entrega.')]);
        pickWrap.style.display = deliveryChk.checked ? 'block' : 'none';
        deliveryChk.onchange = function () { pickWrap.style.display = deliveryChk.checked ? 'block' : 'none'; };
        formHost.appendChild(pickWrap);
      } else {
        formHost.appendChild(field('Valor da doação (R$)', amountIn));
        formHost.appendChild(el('p.muted.tiny', { text: 'Simulação de pagamento — nenhum valor real é cobrado nesta demonstração.' }));
      }
    }
    render();

    function submit() {
      try {
        var data = { orgId: org.id, needId: preNeed ? preNeed.id : null, type: type };
        if (type === 'material') {
          if (!descIn.value.trim()) throw new Error('Descreva o que será doado.');
          data.description = descIn.value.trim();
          data.items = [{ name: descIn.value.trim(), qty: Number(qtyIn.value) || 1, unit: 'un' }];
          data.needsDelivery = deliveryChk.checked;
          if (deliveryChk.checked) {
            var base = (user.location && user.location.lat) ? user.location : { lat: cfg.map.center.lat - 0.035, lng: cfg.map.center.lng - 0.02 };
            data.pickup = { lat: base.lat, lng: base.lng, address: pickupIn.value.trim() || 'Endereço do doador' };
          }
        } else {
          var amt = Number(amountIn.value);
          if (!amt || amt <= 0) throw new Error('Informe um valor válido.');
          data.amount = amt; data.description = 'Doação financeira';
        }
        var d = EP.logic.createDonation(data);
        EP.ui.toast('Doação registrada! 💚', 'success');
        EP.app.go('#/doacao/' + d.id);
      } catch (e) { EP.ui.toast(e.message, 'danger'); }
    }

    return page({ title: 'Doar para ' + org.name, subtitle: org.category + ' · ' + (org.location.address || org.city) }, [
      el('div.donate-grid', {}, [
        el('div.card', {}, [
          field('Tipo de doação', typeSel),
          formHost,
          el('div.form__actions', {}, [
            el('button.btn.btn--ghost', { text: 'Cancelar', onClick: function () { history.back(); } }),
            el('button.btn.btn--primary', { text: 'Confirmar doação', onClick: submit }),
          ]),
        ]),
        el('div.card.donate-aside', {}, [
          el('h3', { text: '🔒 Transparência garantida' }),
          el('p.muted', { text: 'Após doar, você acompanha cada etapa:' }),
          el('div', {}, cfg.donationStatuses.filter(function (s) { return s.key !== 'Em rota'; }).map(function (s) {
            return el('div.aside-step', {}, [el('span', { style: { color: s.color }, text: s.icon }), el('span', { text: ' ' + s.label }), el('div.muted.tiny', { text: s.desc })]);
          })),
        ]),
      ]),
    ]);
  }

  function segBtn(label, active, onClick) {
    return el('button.seg__btn', { class: active ? 'seg__btn--active' : '', text: label, onClick: onClick });
  }

  /* ====================================================================== */
  /* DETALHE / RASTREAMENTO DA DOAÇÃO                                        */
  /* ====================================================================== */
  function donationDetail(params) {
    var d = EP.db.get('donations', params.parts[1]);
    if (!d) return notFound('Doação não encontrada.');
    var org = EP.db.orgById(d.orgId);
    var donor = EP.db.get('users', d.donorId);
    var user = EP.auth.currentUser();
    var del = d.delivery ? EP.db.get('deliveries', d.delivery) : null;

    var title = d.type === 'financial' ? cfg.currency(d.amount) : d.description;

    var col = el('div', {}, [
      el('div.card', {}, [
        el('div.don-detail__head', {}, [
          el('div.don-row__icon', { text: d.type === 'financial' ? '💰' : '📦' }),
          el('div', {}, [
            el('h2', { text: title }),
            el('div.muted', { text: 'Para ' + (org ? org.name : '—') + ' · de ' + (donor ? donor.name : '—') + ' · ' + EP.ui.fmtDate(d.createdAt) }),
          ]),
          C.statusPill(d.status),
        ]),
      ]),
      el('section.section', {}, [el('h3', { text: 'Linha do tempo' }), el('div.card', {}, [C.statusTimeline(d)])]),
    ]);

    // Transparência financeira: para onde foi o dinheiro
    if (d.type === 'financial') col.appendChild(allocationCard(d));

    // Rastreamento de entrega (mapa ao vivo)
    if (del) {
      col.appendChild(deliveryTrackingCard(del, user));
    }

    return page({ title: 'Acompanhamento da doação', subtitle: 'Transparência total: veja onde está e como está sendo usado o seu recurso.' }, [col]);
  }

  function allocationCard(d) {
    var s = EP.logic.allocationSummary(d);
    var pct = s.total ? Math.round(s.used / s.total * 100) : 0;
    return el('section.section', {}, [
      el('h3', { text: '💰 Para onde foi o recurso' }),
      el('div.card', {}, [
        el('div.alloc-summary', {}, [
          el('span', {}, ['Doado: ', el('strong', { text: cfg.currency(s.total) })]),
          el('span', {}, ['Aplicado: ', el('strong', { text: cfg.currency(s.used) + ' (' + pct + '%)' })]),
          el('span', {}, ['A aplicar: ', el('strong', { text: cfg.currency(s.remaining) })]),
        ]),
        el('div.alloc-bar', {}, [el('div.alloc-bar__fill', { style: { width: pct + '%' } })]),
        (d.allocations && d.allocations.length) ? el('div.list', {}, d.allocations.map(function (a) {
          return el('div.alloc-row', {}, [
            el('span', { text: a.description }), el('strong', { text: cfg.currency(a.amount) }),
            a.note ? el('span.muted.tiny', { text: a.note }) : null, el('span.muted.tiny', { text: EP.ui.timeAgo(a.at) }),
          ]);
        })) : el('p.muted', { text: 'A organização ainda não detalhou o uso. Você será notificado quando isso acontecer.' }),
      ]),
    ]);
  }

  function deliveryTrackingCard(del, user) {
    var dstatus = cfg.deliveryStatuses.find(function (s) { return s.key === del.status; }) || {};
    var deliverer = del.delivererId ? EP.db.get('users', del.delivererId) : null;
    var mapHost = el('div.gps-map');
    var statusLine = el('div.deliv-status');

    var card = el('section.section', {}, [
      el('h3', { text: '🛵 Entrega em tempo real' }),
      el('div.card', {}, [
        statusLine,
        mapHost,
        el('div.deliv-info', {}, [
          el('div', {}, [el('span.muted.tiny', { text: 'Coleta' }), el('div', { text: del.pickup.address })]),
          el('div', {}, [el('span.muted.tiny', { text: 'Entrega' }), el('div', { text: del.dropoff.address })]),
          el('div', {}, [el('span.muted.tiny', { text: 'Entregador' }), el('div', { text: deliverer ? deliverer.name : 'Aguardando voluntário' })]),
          el('div.code-box', {}, [el('span.muted.tiny', { text: 'Código de segurança (informe ao entregador)' }), el('div.code', { text: del.code })]),
        ]),
      ]),
    ]);

    function renderStatus() {
      EP.ui.clear(statusLine);
      var m = cfg.deliveryStatuses.find(function (s) { return s.key === del.status; }) || {};
      statusLine.appendChild(el('span.pill', { style: { background: (m.color || '#888') + '18', color: m.color, borderColor: (m.color || '#888') + '55' }, text: (m.icon || '') + ' ' + (m.label || del.status) }));
      if (del.delivererLocation) statusLine.appendChild(el('span.muted.tiny', { text: ' · atualizado ' + EP.ui.timeAgo(del.delivererLocation.at) }));
    }
    renderStatus();

    // monta mapa ao vivo
    var map = new C.GpsMap(mapHost, {
      route: del.route, pickup: del.pickup, dropoff: del.dropoff,
      courier: del.delivererLocation,
    });

    var off1 = EP.bus.on('delivery:moved', function (p) {
      if (p.deliveryId !== del.id) return;
      map.update({ courier: { lat: p.lat, lng: p.lng } });
      del.delivererLocation = { lat: p.lat, lng: p.lng, at: p.at };
      renderStatus();
    });
    var off2 = EP.bus.on('delivery:changed', function (p) {
      if (p.deliveryId !== del.id) return;
      var fresh = EP.db.get('deliveries', del.id);
      if (fresh) { del.status = fresh.status; del.delivererLocation = fresh.delivererLocation; }
      map.update({ courier: del.delivererLocation });
      renderStatus();
    });
    EP.app.onCleanup(off1); EP.app.onCleanup(off2);

    return card;
  }

  /* ====================================================================== */
  /* AUTENTICAÇÃO                                                            */
  /* ====================================================================== */
  function login() {
    var emailIn = input({ type: 'email', placeholder: 'seu@email.com' });
    var passIn = input({ type: 'password', placeholder: 'Senha' });

    function submit() {
      try { EP.auth.login(emailIn.value, passIn.value); EP.ui.toast('Bem-vindo(a) de volta!', 'success'); EP.app.go('#/painel'); }
      catch (e) { EP.ui.toast(e.message, 'danger'); }
    }
    [emailIn, passIn].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); }); });

    var demos = [
      { label: '💝 Doadora (Marina)', email: 'marina@exemplo.com' },
      { label: '🙋 Voluntário (Carlos)', email: 'carlos@exemplo.com' },
      { label: '🛵 Entregador (João)', email: 'joao@exemplo.com' },
      { label: '🏛️ Organização (Ana)', email: 'ana@casadobem.org' },
    ];

    return el('div.auth-page', {}, [
      el('div.card.auth-card', {}, [
        el('h1', { text: 'Entrar' }),
        field('E-mail', emailIn),
        field('Senha', passIn),
        el('button.btn.btn--primary.btn--block', { text: 'Entrar', onClick: submit }),
        el('p.muted.center', {}, ['Não tem conta? ', el('a.link', { href: '#/cadastro', text: 'Cadastre-se' })]),
        el('div.demo-box', {}, [
          el('div.muted.tiny.center', { text: 'Contas de demonstração (senha: ' + cfg.demoPassword + ')' }),
          el('div.demo-grid', {}, demos.map(function (dm) {
            return el('button.btn.btn--sm.btn--ghost', { text: dm.label, onClick: function () {
              emailIn.value = dm.email; passIn.value = cfg.demoPassword; submit();
            } });
          })),
        ]),
      ]),
    ]);
  }

  function register() {
    var roles = ['donor'];
    var nameIn = input({ placeholder: 'Seu nome' });
    var emailIn = input({ type: 'email', placeholder: 'seu@email.com' });
    var passIn = input({ type: 'password', placeholder: 'Crie uma senha (mín. 4)' });
    var cityIn = input({ placeholder: 'Sua cidade', value: 'Natal' });

    var roleBtns = {};
    var roleRow = el('div.role-pick', {}, Object.keys(cfg.roles).map(function (k) {
      var r = cfg.roles[k];
      var b = el('button.role-btn', { class: roles.indexOf(k) >= 0 ? 'role-btn--on' : '', onClick: function () {
        var i = roles.indexOf(k); if (i >= 0) roles.splice(i, 1); else roles.push(k);
        b.classList.toggle('role-btn--on'); renderExtra();
      } }, [el('span.role-btn__emoji', { text: r.emoji }), el('span', { text: r.label })]);
      roleBtns[k] = b; return b;
    }));

    // campos extras (voluntário / organização)
    var skillsChips = multiChips(cfg.skills, []);
    var interestsChips = multiChips(cfg.interests, []);
    var orgName = input({ placeholder: 'Nome da organização' });
    var orgCat = select(cfg.categories);
    var orgDesc = textarea({ placeholder: 'Descreva a missão da organização' });
    var orgVuln = select([{ value: '1', label: '1 - baixa' }, { value: '2', label: '2' }, { value: '3', label: '3 - média' }, { value: '4', label: '4' }, { value: '5', label: '5 - alta' }], '3');
    var extraHost = el('div');

    function renderExtra() {
      EP.ui.clear(extraHost);
      if (roles.indexOf('volunteer') >= 0 || roles.indexOf('deliverer') >= 0) {
        extraHost.appendChild(el('div.card.subcard', {}, [
          el('h4', { text: '🙋 Perfil de voluntário' }),
          field('Suas habilidades', skillsChips, 'Usadas para te conectar às necessidades certas.'),
          field('Seus interesses (causas)', interestsChips),
        ]));
      }
      if (roles.indexOf('org') >= 0) {
        extraHost.appendChild(el('div.card.subcard', {}, [
          el('h4', { text: '🏛️ Dados da organização' }),
          field('Nome', orgName), field('Categoria', orgCat), field('Descrição', orgDesc), field('Nível de vulnerabilidade do público atendido', orgVuln),
        ]));
      }
    }
    renderExtra();

    function submit() {
      try {
        var data = {
          name: nameIn.value, email: emailIn.value, password: passIn.value, roles: roles,
          skills: skillsChips.getValue(), interests: interestsChips.getValue(),
          location: { city: cityIn.value.trim(), lat: cfg.map.center.lat, lng: cfg.map.center.lng },
        };
        if (roles.indexOf('org') >= 0) {
          if (!orgName.value.trim()) throw new Error('Informe o nome da organização.');
          data.org = { name: orgName.value.trim(), category: orgCat.value, description: orgDesc.value, vulnerability: orgVuln.value, city: cityIn.value.trim() };
        }
        EP.auth.register(data);
        EP.ui.toast('Conta criada! Bem-vindo(a) ao ' + cfg.app.name + ' 🎉', 'success');
        EP.app.go('#/painel');
      } catch (e) { EP.ui.toast(e.message, 'danger'); }
    }

    return el('div.auth-page', {}, [
      el('div.card.auth-card.auth-card--wide', {}, [
        el('h1', { text: 'Criar conta' }),
        el('p.muted', { text: 'Você pode ter mais de um papel (ex.: doar e ser voluntário).' }),
        el('div.form-grid', {}, [field('Nome', nameIn), field('Cidade', cityIn), field('E-mail', emailIn), field('Senha', passIn)]),
        field('Eu quero participar como:', roleRow),
        extraHost,
        el('button.btn.btn--primary.btn--block', { text: 'Criar conta', onClick: submit }),
        el('p.muted.center', {}, ['Já tem conta? ', el('a.link', { href: '#/entrar', text: 'Entrar' })]),
      ]),
    ]);
  }

  /* ====================================================================== */
  /* PAINEL (dashboards por papel)                                           */
  /* ====================================================================== */
  function dashboard(params) {
    var user = EP.auth.currentUser();
    if (!user) { EP.app.go('#/entrar'); return el('div'); }

    var availableRoles = user.roles.slice();
    var tab = params.query.tab || availableRoles[0];
    if (availableRoles.indexOf(tab) < 0) tab = availableRoles[0];

    var tabs = el('div.dash-tabs', {}, availableRoles.map(function (r) {
      var meta = cfg.roles[r];
      return el('button.dash-tab', { class: r === tab ? 'dash-tab--active' : '', text: meta.emoji + ' ' + meta.label, onClick: function () { EP.app.go('#/painel?tab=' + r); } });
    }));

    var content;
    if (tab === 'donor') content = donorPanel(user);
    else if (tab === 'org') content = orgPanel(user);
    else if (tab === 'volunteer') content = volunteerPanel(user);
    else if (tab === 'deliverer') content = delivererPanel(user);
    else content = el('div');

    return el('div.page', {}, [
      el('div.dash-header', {}, [
        EP.ui.avatar(user.name, 56),
        el('div', {}, [el('h1', { text: 'Olá, ' + user.name.split(' ')[0] + '!' }), el('div.muted', { text: user.email })]),
      ]),
      availableRoles.length > 1 ? tabs : null,
      content,
    ]);
  }

  /* ---- Painel do DOADOR ------------------------------------------------- */
  function donorPanel(user) {
    var dons = EP.db.donationsForDonor(user.id).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var active = dons.filter(function (d) { return d.status !== 'Usado'; });
    var rec = EP.logic.recommendOrgs(user).slice(0, 3);
    return el('div', {}, [
      el('section.section', {}, [
        el('div.section__head', {}, [el('h2', { text: 'Minhas doações (' + dons.length + ')' }), el('a.link', { href: '#/organizacoes', text: '+ nova doação' })]),
        dons.length ? el('div.list', {}, dons.map(function (d) { return C.donationRow(d); }))
          : el('p.empty', { text: 'Você ainda não fez doações. Que tal começar? 💚' }),
      ]),
      el('section.section', {}, [
        el('h2', { text: 'Recomendadas para você' }),
        el('div.grid.grid--3', {}, rec.map(function (p) { return C.orgCard(p.org); })),
      ]),
    ]);
  }

  /* ---- Painel da ORGANIZAÇÃO -------------------------------------------- */
  function orgPanel(user) {
    var org = EP.db.orgOfUser(user);
    if (!org) return el('p.empty', { text: 'Nenhuma organização vinculada à sua conta.' });

    var sub = el('div.subtabs');
    var body = el('div.subtab-body');
    var subtabs = ['Doações recebidas', 'Necessidades', 'Voluntários', 'Impacto', 'Pontos'];
    var current = 'Doações recebidas';

    function renderSub() {
      EP.ui.clear(sub); EP.ui.clear(body);
      subtabs.forEach(function (t) {
        var label = t;
        if (t === 'Voluntários') {
          var pc = EP.logic.applicationsForOrg(org.id).filter(function (a) { return a.status === 'pendente'; }).length;
          if (pc) label = t + ' (' + pc + ')';
        }
        sub.appendChild(el('button.subtab', { class: t === current ? 'subtab--active' : '', text: label, onClick: function () { current = t; renderSub(); } }));
      });
      if (current === 'Necessidades') body.appendChild(orgNeeds(org));
      else if (current === 'Doações recebidas') body.appendChild(orgDonations(org, user));
      else if (current === 'Voluntários') body.appendChild(orgApplications(org));
      else if (current === 'Impacto') body.appendChild(orgPosts(org));
      else if (current === 'Pontos') body.appendChild(orgPoints(org));
    }
    renderSub();

    return el('div', {}, [
      el('div.card.org-summary', {}, [
        EP.ui.avatar(org.name, 56),
        el('div.org-summary__main', {}, [
          el('h2', {}, [el('span', { text: org.name }), org.verified ? el('span.verified', { text: ' ✔' }) : null]),
          el('div.muted', { text: org.category + ' · ' + org.city }),
        ]),
        el('div.org-summary__trust', {}, [C.trustBadge(org), el('a.link.tiny', { href: '#/org/' + org.id, text: 'ver página pública →' })]),
      ]),
      sub, body,
    ]);
  }

  function orgNeeds(org) {
    var wrap = el('div');
    wrap.appendChild(el('div.section__head', {}, [
      el('h3', { text: 'Necessidades' }),
      el('button.btn.btn--sm.btn--primary', { text: '+ Nova necessidade', onClick: function () { needForm(org, null, function () { current_rerender(); }); } }),
    ]));
    var needs = EP.db.needsOfOrg(org.id).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var grid = el('div.grid.grid--2', {}, needs.map(function (n) {
      return C.needCard(n, org, {
        onEdit: function (need) { needForm(org, need, function () { current_rerender(); }); },
        onClose: function (need) { EP.db.update('needs', need.id, { status: need.status === 'open' ? 'closed' : 'open' }); current_rerender(); },
      });
    }));
    wrap.appendChild(needs.length ? grid : el('p.muted', { text: 'Nenhuma necessidade cadastrada.' }));
    function current_rerender() { EP.app.render(); }
    return wrap;
  }

  function needForm(org, need, done) {
    var titleIn = input({ value: need ? need.title : '', placeholder: 'Ex.: 100 cestas básicas' });
    var typeSel = select(cfg.needTypes.map(function (t) { return { value: t.key, label: t.emoji + ' ' + t.label }; }), need ? need.type : 'material');
    var catSel = select(cfg.categories, need ? need.category : org.category);
    var descIn = textarea({ value: need ? need.description : '' });
    var urgSel = select(['1', '2', '3', '4', '5'], String(need ? need.urgency : 3));
    var skillsChips = multiChips(cfg.skills, need ? (need.skills || []) : []);

    var body = el('div.form', {}, [
      field('Título', titleIn), field('Tipo', typeSel), field('Categoria', catSel),
      field('Descrição', descIn), field('Urgência (1-5)', urgSel),
      field('Habilidades desejadas (p/ voluntários)', skillsChips),
    ]);

    EP.ui.modal({
      title: need ? 'Editar necessidade' : 'Nova necessidade', body: body,
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Salvar', kind: 'primary', onClick: function () {
          if (!titleIn.value.trim()) { EP.ui.toast('Informe o título.', 'danger'); return false; }
          var data = { title: titleIn.value.trim(), type: typeSel.value, category: catSel.value, description: descIn.value.trim(), urgency: Number(urgSel.value), skills: skillsChips.getValue() };
          if (need) EP.db.update('needs', need.id, data);
          else EP.db.insert('needs', Object.assign({ orgId: org.id, status: 'open', fulfilled: 0 }, data));
          EP.ui.toast('Necessidade salva.', 'success');
          done && done();
        } },
      ],
    });
  }

  function orgDonations(org, user) {
    var dons = EP.db.donationsForOrg(org.id).sort(function (a, b) { return b.createdAt - a.createdAt; });
    if (!dons.length) return el('p.empty', { text: 'Nenhuma doação recebida ainda.' });
    return el('div.list', {}, dons.map(function (d) {
      var donor = EP.db.get('users', d.donorId);
      var nexts = EP.logic.nextOrgStatuses(d);
      var actions = nexts.map(function (s) {
        var meta = EP.logic.statusMeta(s);
        return el('button.btn.btn--sm', { style: { background: meta.color, color: '#fff', borderColor: meta.color }, text: 'Marcar ' + meta.label, onClick: function () {
          confirmAdvance(d, s, user, org);
        } });
      });
      var waitingDelivery = d.delivery && d.status === 'Pendente';
      var row = el('div.card.org-don', {}, [
        el('div.org-don__head', {}, [
          el('div.don-row__icon', { text: d.type === 'financial' ? '💰' : '📦' }),
          el('div.org-don__info', {}, [
            el('strong', { text: d.type === 'financial' ? cfg.currency(d.amount) : d.description }),
            el('div.muted.tiny', { text: 'de ' + (donor ? donor.name : '—') + ' · ' + EP.ui.timeAgo(d.createdAt) }),
          ]),
          C.statusPill(d.status),
        ]),
        d.delivery ? el('div.muted.tiny', { text: '🛵 Esta doação está sendo entregue. O status avançará automaticamente após a entrega confirmada.' }) : null,
        actions.length ? el('div.org-don__actions', {}, actions) : (d.status === 'Usado' ? el('div.muted.tiny', { text: '✅ Ciclo concluído.' }) : null),
        el('div.org-don__actions', {}, [
          (d.status === 'Usado' || d.status === 'Em estoque') ? el('button.btn.btn--sm.btn--accent', { text: '📣 Publicar impacto', onClick: function () { postForm(org, d); } }) : null,
          (d.type === 'financial' && (d.status === 'Recebido' || d.status === 'Usado')) ? el('button.btn.btn--sm.btn--ghost', { text: '💰 Detalhar alocação', onClick: function () { allocationForm(d); } }) : null,
        ]),
        (d.type === 'financial' && d.allocations && d.allocations.length) ? el('div.muted.tiny', { text: '💰 ' + cfg.currency(EP.logic.allocationSummary(d).used) + ' de ' + cfg.currency(d.amount) + ' já detalhados' }) : null,
      ]);
      return row;
    }));
  }

  function confirmAdvance(d, status, user, org) {
    var meta = EP.logic.statusMeta(status);
    var noteIn = textarea({ placeholder: 'Mensagem para o doador (opcional). Ex.: distribuímos para 20 famílias.' });
    EP.ui.modal({
      title: 'Marcar como "' + meta.label + '"',
      body: el('div', {}, [
        el('p.muted', { text: meta.desc }),
        field('Observação (visível ao doador)', noteIn),
        el('p.points-hint', { text: '+' + (EP.config.points[status === 'Recebido' ? 'receiveDonation' : status === 'Em estoque' ? 'stockDonation' : 'useDonation'] || 0) + ' Pontos de Confiança 🏆' }),
      ]),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Confirmar', kind: 'primary', onClick: function () {
          EP.logic.advanceDonation(d.id, status, user.id, noteIn.value.trim());
          EP.ui.toast('Status atualizado para "' + meta.label + '". ' + (status === 'Usado' ? 'Que tal publicar o impacto? 📣' : ''), 'success');
          EP.app.render();
        } },
      ],
    });
  }

  function orgPosts(org) {
    var posts = EP.db.postsForOrg(org.id).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var wrap = el('div');
    wrap.appendChild(el('div.section__head', {}, [
      el('h3', { text: 'Postagens de impacto' }),
      el('button.btn.btn--sm.btn--accent', { text: '+ Nova postagem (+' + cfg.points.impactPost + ' pts)', onClick: function () { postForm(org, null); } }),
    ]));
    wrap.appendChild(posts.length ? el('div.grid.grid--2', {}, posts.map(function (p) { return C.postCard(p); })) : el('p.muted', { text: 'Compartilhe o impacto das doações para ganhar pontos de confiança!' }));
    return wrap;
  }

  function postForm(org, donation) {
    var titleIn = input({ placeholder: 'Ex.: 20 famílias alimentadas esta semana' });
    var bodyIn = textarea({ rows: 4, placeholder: 'Conte o que foi feito com as doações...' });
    var emojiIn = input({ value: '💚', placeholder: 'Emoji' });
    var orgDonations = EP.db.donationsForOrg(org.id);
    var linkSel = select([{ value: '', label: '— nenhuma —' }].concat(orgDonations.map(function (d) {
      return { value: d.id, label: (d.type === 'financial' ? cfg.currency(d.amount) : d.description) + ' (' + d.status + ')' };
    })), donation ? donation.id : '');

    EP.ui.modal({
      title: '📣 Publicar impacto',
      body: el('div.form', {}, [field('Título', titleIn), field('Mensagem', bodyIn), field('Emoji', emojiIn), field('Vincular a uma doação (opcional)', linkSel)]),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Publicar (+' + cfg.points.impactPost + ' pts)', kind: 'accent', onClick: function () {
          if (!titleIn.value.trim() || !bodyIn.value.trim()) { EP.ui.toast('Preencha título e mensagem.', 'danger'); return false; }
          EP.logic.createPost(org.id, { title: titleIn.value.trim(), body: bodyIn.value.trim(), image: emojiIn.value || '📣', donationId: linkSel.value || null });
          EP.ui.toast('Postagem publicada! +' + cfg.points.impactPost + ' pts 🏆', 'success');
          EP.app.render();
        } },
      ],
    });
  }

  function orgPoints(org) {
    var log = EP.logic.pointsLog(org.id);
    var tier = EP.logic.trustTier(org.trustPoints || 0);
    return el('div', {}, [
      el('div.card.points-summary', {}, [
        el('div.points-big', { text: (org.trustPoints || 0) + ' pts' }),
        C.trustBadge(org),
        el('p.muted', { text: 'Nível atual: ' + tier.icon + ' ' + tier.label + '. Confirme recebimentos, registre o uso e publique impacto para subir de nível e atrair mais doações.' }),
      ]),
      el('h4', { text: 'Histórico de pontos' }),
      log.length ? el('div.list', {}, log.map(function (p) {
        return el('div.point-row', {}, [el('span.point-row__amt', { text: '+' + p.amount }), el('span', { text: p.reason }), el('span.muted.tiny', { text: EP.ui.timeAgo(p.at) })]);
      })) : el('p.muted', { text: 'Sem pontos ainda.' }),
    ]);
  }

  /* ---- Caixa de entrada de voluntários (laço fechado) ------------------- */
  function orgApplications(org) {
    var apps = EP.logic.applicationsForOrg(org.id);
    if (!apps.length) return el('p.empty', { text: 'Nenhuma candidatura ainda. Cadastre necessidades do tipo "Voluntário" para receber candidatos compatíveis. 🙋' });
    return el('div.list', {}, apps.map(function (a) {
      var vol = EP.db.get('users', a.volunteerId);
      var need = EP.db.get('needs', a.needId);
      var color = a.status === 'aceita' ? cfg.theme.primary : a.status === 'recusada' ? cfg.theme.danger : cfg.theme.accent;
      var actions = [];
      if (a.status === 'pendente') {
        actions.push(el('button.btn.btn--sm.btn--primary', { text: '✓ Aceitar', onClick: function () { EP.logic.respondApplication(a.id, 'aceita'); EP.ui.toast('Voluntário aceito! Ele foi notificado. 🙌', 'success'); EP.app.render(); } }));
        actions.push(el('button.btn.btn--sm.btn--ghost', { text: 'Recusar', onClick: function () { EP.logic.respondApplication(a.id, 'recusada'); EP.ui.toast('Candidatura recusada.', 'info'); EP.app.render(); } }));
      }
      return el('div.card.appl', {}, [
        el('div.appl__head', {}, [
          EP.ui.avatar(vol ? vol.name : '?', 44),
          el('div.appl__info', {}, [
            el('strong', { text: vol ? vol.name : '—' }),
            el('div.muted.tiny', { text: 'candidatou-se para "' + (need ? need.title : '') + '" · ' + EP.ui.timeAgo(a.createdAt) }),
            (vol && vol.skills && vol.skills.length) ? el('div.chips', {}, vol.skills.map(function (s) {
              return EP.ui.chip(s, { active: need && need.skills && need.skills.indexOf(s) >= 0 });
            })) : null,
          ]),
          EP.ui.badge(a.status, color),
        ]),
        a.message ? el('p.appl__msg', { text: '“' + a.message + '”' }) : null,
        actions.length ? el('div.appl__actions', {}, actions) : null,
      ]);
    }));
  }

  /* ---- Alocação financeira (transparência do dinheiro) ----------------- */
  function allocationForm(d) {
    var descIn = input({ placeholder: 'Ex.: Compra de 20 cestas básicas' });
    var amtIn = input({ type: 'number', min: '0', step: '0.01', placeholder: '0,00' });
    var noteIn = input({ placeholder: 'Fornecedor / nº do comprovante (opcional)' });
    var listHost = el('div');

    function renderList() {
      EP.ui.clear(listHost);
      var s = EP.logic.allocationSummary(d);
      listHost.appendChild(el('div.alloc-summary', {}, [
        el('span', {}, ['Recebido: ', el('strong', { text: cfg.currency(s.total) })]),
        el('span', {}, ['Alocado: ', el('strong', { text: cfg.currency(s.used) })]),
        el('span', {}, ['Restante: ', el('strong', { text: cfg.currency(s.remaining) })]),
      ]));
      (d.allocations || []).forEach(function (a) {
        listHost.appendChild(el('div.alloc-row', {}, [el('span', { text: a.description }), el('strong', { text: cfg.currency(a.amount) }), a.note ? el('span.muted.tiny', { text: a.note }) : null]));
      });
    }
    renderList();

    EP.ui.modal({
      title: '💰 Alocação da doação financeira',
      body: el('div.form', {}, [
        el('p.muted', { text: 'Registre em que o dinheiro foi usado. O doador vê isso na página de acompanhamento e é notificado.' }),
        listHost,
        field('Descrição do gasto', descIn), field('Valor (R$)', amtIn), field('Comprovante/obs.', noteIn),
        el('div.form__actions', {}, [el('button.btn.btn--sm.btn--primary', { text: '+ Adicionar', onClick: function () {
          if (!descIn.value.trim() || !(Number(amtIn.value) > 0)) { EP.ui.toast('Informe descrição e valor.', 'danger'); return; }
          EP.logic.addAllocation(d.id, { description: descIn.value.trim(), amount: amtIn.value, note: noteIn.value.trim() });
          descIn.value = ''; amtIn.value = ''; noteIn.value = ''; renderList(); EP.ui.toast('Alocação registrada. Doador notificado. 💚', 'success');
        } })]),
      ]),
      actions: [{ label: 'Fechar', kind: 'ghost', onClick: function () { EP.app.render(); } }],
    });
  }

  /* ---- Painel do VOLUNTÁRIO --------------------------------------------- */
  function volunteerPanel(user) {
    var matches = EP.logic.matchesForUser(user);
    var profileCard = el('div.card.vol-profile', {}, [
      el('div.section__head', {}, [el('h3', { text: '🙋 Meu perfil de voluntário' }), el('button.btn.btn--sm.btn--ghost', { text: 'Editar perfil', onClick: function () { editVolunteerProfile(user); } })]),
      el('div', {}, [
        el('div.muted.tiny', { text: 'Habilidades' }),
        el('div.chips', {}, (user.skills && user.skills.length ? user.skills : ['—']).map(function (s) { return EP.ui.chip(s); })),
        el('div.muted.tiny', { text: 'Interesses' }),
        el('div.chips', {}, (user.interests && user.interests.length ? user.interests : ['—']).map(function (s) { return EP.ui.chip(s); })),
        user.availability ? el('div.muted.tiny', { text: 'Disponibilidade: ' + user.availability }) : null,
      ]),
    ]);

    var matchSection = el('section.section', {}, [
      el('h3', { text: '🎯 Oportunidades para você (' + matches.length + ')' }),
      el('p.muted', { text: 'Necessidades de voluntariado ordenadas pela compatibilidade com suas habilidades, interesses e localização.' }),
      matches.length ? el('div.grid.grid--2', {}, matches.map(function (m) {
        var card = C.needCard(m.need, m.org, { showVolunteer: true, showOrg: true });
        card.insertBefore(el('div.match-score', {}, [
          el('span.match-score__badge', { text: '★ ' + m.score + ' pts de compatibilidade' }),
          m.reasons.length ? el('div.match-score__reasons.muted.tiny', { text: m.reasons.join(' · ') }) : null,
        ]), card.firstChild);
        return card;
      })) : el('p.empty', { text: 'Nenhuma oportunidade compatível por enquanto. Adicione mais habilidades ao seu perfil!' }),
    ]);

    var apps = EP.logic.applicationsForVolunteer(user.id);
    var applSection = apps.length ? el('section.section', {}, [
      el('h3', { text: '📋 Minhas candidaturas (' + apps.length + ')' }),
      el('div.list', {}, apps.map(function (a) {
        var need = EP.db.get('needs', a.needId); var org = EP.db.orgById(a.orgId);
        var color = a.status === 'aceita' ? cfg.theme.primary : a.status === 'recusada' ? cfg.theme.danger : cfg.theme.accent;
        return el('div.card.appl-mine', { onClick: function () { if (org) EP.app.go('#/org/' + org.id); } }, [
          el('div', {}, [el('strong', { text: need ? need.title : '—' }), el('div.muted.tiny', { text: (org ? org.name : '') + ' · ' + EP.ui.timeAgo(a.createdAt) })]),
          EP.ui.badge(a.status, color),
        ]);
      })),
    ]) : null;

    return el('div', {}, [profileCard, matchSection, applSection]);
  }

  function editVolunteerProfile(user) {
    var skillsChips = multiChips(cfg.skills, user.skills || []);
    var interestsChips = multiChips(cfg.interests, user.interests || []);
    var availIn = input({ value: user.availability || '', placeholder: 'Ex.: fins de semana' });
    var bioIn = textarea({ value: user.bio || '' });
    EP.ui.modal({
      title: 'Editar perfil de voluntário',
      body: el('div.form', {}, [field('Habilidades', skillsChips), field('Interesses', interestsChips), field('Disponibilidade', availIn), field('Bio', bioIn)]),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Salvar', kind: 'primary', onClick: function () {
          EP.db.update('users', user.id, { skills: skillsChips.getValue(), interests: interestsChips.getValue(), availability: availIn.value, bio: bioIn.value });
          EP.auth.refresh(); EP.ui.toast('Perfil atualizado!', 'success'); EP.app.render();
        } },
      ],
    });
  }

  function applyVolunteer(need, org) {
    if (!requireLogin('se candidatar')) return;
    var user = EP.auth.currentUser();
    if (EP.logic.hasApplied(need.id, user.id)) { EP.ui.toast('Você já se candidatou a esta vaga. 🙂', 'info'); return; }
    var msgIn = textarea({ placeholder: 'Conte por que você é ideal (habilidades, disponibilidade)...' });
    EP.ui.modal({
      title: 'Candidatar-se: ' + need.title,
      body: el('div.form', {}, [
        el('p', {}, ['Você está se candidatando para ajudar ', el('strong', { text: org.name }), ' com: ', el('em', { text: need.title }), '.']),
        field('Mensagem para a organização', msgIn),
      ]),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Enviar candidatura', kind: 'accent', onClick: function () {
          try { EP.logic.applyToNeed(need.id, user.id, msgIn.value.trim()); EP.ui.toast('Candidatura enviada! A organização foi notificada. 🙌', 'success'); EP.app.render(); }
          catch (e) { EP.ui.toast(e.message, 'danger'); return false; }
        } },
      ],
    });
  }

  /* ---- Painel do ENTREGADOR --------------------------------------------- */
  function delivererPanel(user) {
    var openDel = EP.logic.openDeliveries();
    var mine = EP.db.query('deliveries', function (d) { return d.delivererId === user.id; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var active = mine.filter(function (d) { return d.status !== 'Entregue'; });

    var wrap = el('div');

    // Entrega ativa com controles de GPS
    if (active.length) {
      active.forEach(function (del) { wrap.appendChild(activeDeliveryCard(del, user)); });
    }

    wrap.appendChild(el('section.section', {}, [
      el('h3', { text: '📦 Entregas disponíveis (' + openDel.length + ')' }),
      el('p.muted', { text: 'Aceite uma entrega para mediar a doação entre o doador e a organização.' }),
      openDel.length ? el('div.list', {}, openDel.map(function (del) {
        var org = EP.db.orgById(del.orgId);
        var don = EP.db.get('donations', del.donationId);
        return el('div.card.deliv-open', {}, [
          el('div.deliv-open__main', {}, [
            el('strong', { text: '📦 ' + (don ? don.description : 'Doação') }),
            el('div.muted.tiny', { text: 'De ' + del.pickup.address }),
            el('div.muted.tiny', { text: 'Para ' + (org ? org.name : '') + ' — ' + del.dropoff.address }),
          ]),
          el('button.btn.btn--sm.btn--primary', { text: 'Aceitar entrega', onClick: function () {
            EP.logic.acceptDelivery(del.id, user.id); EP.ui.toast('Entrega aceita! Inicie o rastreamento.', 'success'); EP.app.render();
          } }),
        ]);
      })) : el('p.muted', { text: 'Nenhuma entrega aguardando no momento.' }),
    ]));

    var done = mine.filter(function (d) { return d.status === 'Entregue'; });
    if (done.length) {
      wrap.appendChild(el('section.section', {}, [
        el('h3', { text: '✅ Entregas concluídas (' + done.length + ')' }),
        el('div.list', {}, done.map(function (del) {
          var org = EP.db.orgById(del.orgId);
          return el('div.card.deliv-done', {}, [el('span', { text: '✅ ' + (org ? org.name : '') }), el('span.muted.tiny', { text: EP.ui.timeAgo(del.deliveredAt) })]);
        })),
      ]));
    }

    return wrap;
  }

  function activeDeliveryCard(del, user) {
    var org = EP.db.orgById(del.orgId);
    var don = EP.db.get('donations', del.donationId);
    var mapHost = el('div.gps-map');
    var statusHost = el('div.deliv-status');
    var controls = el('div.deliv-controls');
    var simTimer = null;

    var map = new C.GpsMap(mapHost, { route: del.route, pickup: del.pickup, dropoff: del.dropoff, courier: del.delivererLocation });

    function renderStatus() {
      EP.ui.clear(statusHost);
      var m = cfg.deliveryStatuses.find(function (s) { return s.key === del.status; }) || {};
      statusHost.appendChild(el('span.pill', { style: { background: (m.color || '#888') + '18', color: m.color, borderColor: (m.color || '#888') + '55' }, text: (m.icon || '') + ' ' + (m.label || del.status) }));
    }

    function renderControls() {
      EP.ui.clear(controls);
      // Simular trajeto
      var simBtn = el('button.btn.btn--sm.btn--info');
      simBtn.textContent = simTimer ? '⏸ Pausar simulação' : '▶ Simular trajeto (GPS)';
      simBtn.onclick = function () {
        if (simTimer) { clearInterval(simTimer); simTimer = null; renderControls(); return; }
        simTimer = setInterval(function () {
          var fresh = EP.db.get('deliveries', del.id);
          var idx = (fresh.routeIndex || 0) + 1;
          if (idx >= fresh.route.length) {
            clearInterval(simTimer); simTimer = null;
            if (del.status === 'Aceita') EP.logic.setDeliveryStatus(del.id, 'Coletado');
            EP.ui.toast('Você chegou ao destino. Confirme a entrega com o código.', 'info');
            renderControls();
            return;
          }
          var pt = fresh.route[idx];
          // ao passar do meio do caminho, marca "Coletado"
          if (idx >= Math.floor(fresh.route.length / 2) && del.status === 'Aceita') { EP.logic.setDeliveryStatus(del.id, 'Coletado'); del.status = 'Coletado'; renderStatus(); }
          EP.logic.updateDelivererLocation(del.id, pt.lat, pt.lng, idx);
          del.delivererLocation = { lat: pt.lat, lng: pt.lng, at: Date.now() };
          map.update({ courier: pt, follow: true });
        }, cfg.map.gpsUpdateMs);
        renderControls();
        EP.app.onCleanup(function () { if (simTimer) clearInterval(simTimer); });
      };
      controls.appendChild(simBtn);

      // GPS real
      var gpsBtn = el('button.btn.btn--sm.btn--ghost', { text: '📍 Usar meu GPS real', onClick: function () { startRealGps(del, map); } });
      controls.appendChild(gpsBtn);

      // Marcar coletado
      if (del.status === 'Aceita') {
        controls.appendChild(el('button.btn.btn--sm.btn--ghost', { text: '📦 Marcar coletado', onClick: function () { EP.logic.setDeliveryStatus(del.id, 'Coletado'); del.status = 'Coletado'; renderStatus(); renderControls(); } }));
      }

      // Confirmar entrega (código)
      if (del.status !== 'Entregue') {
        controls.appendChild(el('button.btn.btn--sm.btn--primary', { text: '✅ Confirmar entrega (código)', onClick: function () { confirmDeliveryModal(del); } }));
      }
    }

    renderStatus(); renderControls();

    var off = EP.bus.on('delivery:changed', function (p) {
      if (p.deliveryId !== del.id) return;
      var fresh = EP.db.get('deliveries', del.id);
      if (fresh) del.status = fresh.status;
      renderStatus(); renderControls();
    });
    EP.app.onCleanup(off);
    EP.app.onCleanup(function () { if (simTimer) clearInterval(simTimer); });

    return el('section.section', {}, [
      el('h3', { text: '🛵 Entrega ativa' }),
      el('div.card', {}, [
        el('div.deliv-active__head', {}, [
          el('div', {}, [el('strong', { text: don ? don.description : 'Doação' }), el('div.muted.tiny', { text: 'Para ' + (org ? org.name : '') })]),
          statusHost,
        ]),
        mapHost,
        el('div.deliv-route.muted.tiny', {}, [el('div', { text: '📦 Coleta: ' + del.pickup.address }), el('div', { text: '🏛️ Entrega: ' + del.dropoff.address })]),
        controls,
        el('div.code-hint.muted.tiny', { text: 'Peça o código de 4 dígitos a quem receber para confirmar a entrega.' }),
      ]),
    ]);
  }

  function startRealGps(del, map) {
    if (!navigator.geolocation) { EP.ui.toast('Seu navegador não suporta geolocalização.', 'danger'); return; }
    EP.ui.toast('Obtendo sua localização real...', 'info');
    var watchId = navigator.geolocation.watchPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      EP.logic.updateDelivererLocation(del.id, lat, lng);
      del.delivererLocation = { lat: lat, lng: lng, at: Date.now() };
      map.update({ courier: { lat: lat, lng: lng }, follow: true });
    }, function (err) { EP.ui.toast('Não foi possível obter GPS: ' + err.message, 'danger'); },
      { enableHighAccuracy: true, maximumAge: 1000 });
    EP.app.onCleanup(function () { navigator.geolocation.clearWatch(watchId); });
    EP.ui.toast('Rastreamento GPS real ativo. 📍', 'success');
  }

  function confirmDeliveryModal(del) {
    var codeIn = input({ inputmode: 'numeric', maxlength: '4', placeholder: '0000', style: { fontSize: '24px', letterSpacing: '8px', textAlign: 'center' } });
    EP.ui.modal({
      title: '✅ Confirmar entrega',
      body: el('div', {}, [el('p.muted', { text: 'Digite o código de 4 dígitos informado por quem está recebendo a doação:' }), codeIn]),
      actions: [
        { label: 'Cancelar', kind: 'ghost' },
        { label: 'Confirmar', kind: 'primary', onClick: function () {
          try { EP.logic.confirmDelivery(del.id, codeIn.value); EP.ui.toast('Entrega confirmada! Obrigado por mediar. 🙌', 'success'); EP.app.render(); }
          catch (e) { EP.ui.toast(e.message, 'danger'); return false; }
        } },
      ],
    });
  }

  /* ====================================================================== */
  /* FEED DE IMPACTO                                                         */
  /* ====================================================================== */
  function feed() {
    var posts = EP.logic.feed();
    return page({ title: '💚 Feed de impacto', subtitle: 'Veja como as doações estão transformando vidas no ' + cfg.app.region + '.' }, [
      posts.length ? el('div.grid.grid--2', {}, posts.map(function (p) { return C.postCard(p); })) : el('p.empty', { text: 'Ainda não há postagens.' }),
    ]);
  }

  /* ====================================================================== */
  /* UTIL                                                                    */
  /* ====================================================================== */
  function notFound(msg) {
    return page({ title: 'Ops!' }, [el('p.empty', { text: msg || 'Página não encontrada.' }), el('a.link', { href: '#/', text: '← Voltar ao início' })]);
  }

  return {
    home: home, orgsList: orgsList, orgDetail: orgDetail, donate: donate, donationDetail: donationDetail,
    login: login, register: register, dashboard: dashboard, feed: feed,
    applyVolunteer: applyVolunteer, notFound: notFound,
  };
})();
