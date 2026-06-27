/* =============================================================================
 * db.js — Camada de dados (banco em localStorage)
 * -----------------------------------------------------------------------------
 * Funciona como um mini-banco de dados. Cada "coleção" é um array de objetos.
 * A API (all/get/insert/update/remove/query) imita um repositório, o que
 * facilita trocar por um backend real depois: basta reimplementar estes
 * métodos chamando uma API HTTP, sem mexer no resto do app.
 * ========================================================================== */
window.EP = window.EP || {};

EP.db = (function () {
  var KEY = (EP.config && EP.config.storageKey) || 'elo_potiguar_db_v1';
  var state = null;

  var EMPTY = {
    meta: { version: 1, seededAt: null },
    users: [],
    organizations: [],
    needs: [],
    donations: [],
    deliveries: [],
    posts: [],
    pointsLedger: [],
    applications: [],     // candidaturas de voluntários a necessidades
    notifications: [],    // avisos por usuário (sininho)
    counters: {},
  };

  /* ---- Persistência ----------------------------------------------------- */
  function load() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) { state = null; }
    if (!state) { state = clone(EMPTY); seed(); save(); }
    // garante coleções caso o schema evolua
    Object.keys(EMPTY).forEach(function (k) { if (state[k] == null) state[k] = clone(EMPTY[k]); });
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('Falha ao salvar', e); }
    return state;
  }

  function reset(reseed) {
    state = clone(EMPTY);
    if (reseed !== false) seed();
    save();
    return state;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---- IDs -------------------------------------------------------------- */
  function id(prefix) {
    var s = load();
    s.counters[prefix] = (s.counters[prefix] || 0) + 1;
    return prefix + '_' + s.counters[prefix];
  }

  /* ---- CRUD genérico ---------------------------------------------------- */
  function all(coll) { return load()[coll] || []; }
  function get(coll, theId) { return all(coll).find(function (x) { return x.id === theId; }) || null; }
  function query(coll, pred) { return all(coll).filter(pred); }

  function insert(coll, obj) {
    var s = load();
    if (!obj.id) obj.id = id(coll.slice(0, 3));
    if (!obj.createdAt) obj.createdAt = Date.now();
    s[coll].push(obj);
    save();
    return obj;
  }

  function update(coll, theId, patch) {
    var item = get(coll, theId);
    if (!item) return null;
    Object.assign(item, typeof patch === 'function' ? patch(item) : patch);
    save();
    return item;
  }

  function remove(coll, theId) {
    var s = load();
    s[coll] = s[coll].filter(function (x) { return x.id !== theId; });
    save();
  }

  /* ---- Conveniências ---------------------------------------------------- */
  function userByEmail(email) {
    email = String(email || '').toLowerCase().trim();
    return all('users').find(function (u) { return u.email.toLowerCase() === email; }) || null;
  }
  function orgById(oid) { return get('organizations', oid); }
  function orgOfUser(user) { return user && user.orgId ? orgById(user.orgId) : null; }
  function needsOfOrg(oid) { return query('needs', function (n) { return n.orgId === oid; }); }
  function donationsForOrg(oid) { return query('donations', function (d) { return d.orgId === oid; }); }
  function donationsForDonor(uid) { return query('donations', function (d) { return d.donorId === uid; }); }
  function postsForOrg(oid) { return query('posts', function (p) { return p.orgId === oid; }); }

  /* =========================================================================
   * SEED — dados de demonstração
   * ====================================================================== */
  function seed() {
    var now = Date.now();
    var DAY = 86400000;
    var hash = (EP.auth && EP.auth.hashSync) ? EP.auth.hashSync : function (p, s) { return 'plain:' + p; };
    var pw = (EP.config && EP.config.demoPassword) || '123456';
    function mkpass() { var salt = Math.random().toString(36).slice(2, 10); return { salt: salt, passwordHash: hash(pw, salt) }; }

    function U(o) { o.id = o.id || id('use'); o.createdAt = o.createdAt || now; Object.assign(o, mkpass()); state.users.push(o); return o; }
    function O(o) { o.id = o.id || id('org'); o.createdAt = o.createdAt || now; o.trustPoints = o.trustPoints || 0; state.organizations.push(o); return o; }
    function N(o) { o.id = o.id || id('nee'); o.createdAt = o.createdAt || now; o.fulfilled = o.fulfilled || 0; o.status = o.status || 'open'; state.needs.push(o); return o; }

    /* ---- Organizações ---- */
    var org1 = O({ name: 'Casa do Bem', category: 'Alimentação', city: 'Natal',
      description: 'Distribui refeições e cestas básicas para famílias em situação de rua na Zona Leste de Natal.',
      vulnerability: 5, verified: true, location: { lat: -5.805, lng: -35.215, address: 'Rua das Flores, 120 — Cidade Alta, Natal/RN' } });
    var org2 = O({ name: 'Mãos que Acolhem', category: 'Educação', city: 'Natal',
      description: 'Reforço escolar e atividades para crianças em comunidades periféricas.',
      vulnerability: 4, verified: true, location: { lat: -5.780, lng: -35.200, address: 'Av. dos Caiapós, 540 — Pajuçara, Natal/RN' } });
    var org3 = O({ name: 'Patas Felizes', category: 'Animais', city: 'Parnamirim',
      description: 'Resgate, cuidado e adoção de animais abandonados.',
      vulnerability: 3, verified: false, location: { lat: -5.910, lng: -35.262, address: 'Rua do Sol, 30 — Parnamirim/RN' } });
    var org4 = O({ name: 'Lar São Vicente', category: 'Idosos', city: 'Natal',
      description: 'Abrigo e cuidados para idosos sem suporte familiar.',
      vulnerability: 4, verified: true, location: { lat: -5.770, lng: -35.230, address: 'Rua da Saudade, 88 — Petrópolis, Natal/RN' } });

    /* ---- Usuários ---- */
    var ana = U({ name: 'Ana Ferreira', email: 'ana@casadobem.org', roles: ['org'], orgId: org1.id, location: { city: 'Natal' } });
    var bruno = U({ name: 'Bruno Alves', email: 'bruno@maos.org', roles: ['org'], orgId: org2.id, location: { city: 'Natal' } });
    U({ name: 'Clara Dias', email: 'clara@pataspelizes.org', roles: ['org'], orgId: org3.id, location: { city: 'Parnamirim' } });
    U({ name: 'Dona Lúcia', email: 'lucia@larsaovicente.org', roles: ['org'], orgId: org4.id, location: { city: 'Natal' } });

    var marina = U({ name: 'Marina Souza', email: 'marina@exemplo.com', roles: ['donor'], location: { city: 'Natal', lat: -5.83, lng: -35.22 } });
    var carlos = U({ name: 'Carlos Lima', email: 'carlos@exemplo.com', roles: ['volunteer', 'donor'],
      skills: ['Programação', 'Ensino', 'Design'], interests: ['Educação', 'Crianças'], availability: 'Fins de semana',
      bio: 'Desenvolvedor que adora ensinar.', location: { city: 'Natal', lat: -5.79, lng: -35.21 } });
    var joao = U({ name: 'João Mota', email: 'joao@exemplo.com', roles: ['deliverer', 'volunteer'],
      skills: ['Transporte', 'Carpintaria'], interests: ['Alimentação'], availability: 'Tardes',
      bio: 'Tenho moto e tempo livre para ajudar nas entregas.', location: { city: 'Natal', lat: -5.80, lng: -35.21 } });

    /* ---- Necessidades ---- */
    var n1 = N({ orgId: org1.id, title: '300 cestas básicas', type: 'material', category: 'Alimentação',
      description: 'Arroz, feijão, óleo, açúcar e itens de higiene.', quantity: 300, unit: 'cestas', urgency: 5 });
    N({ orgId: org1.id, title: 'Voluntário cozinheiro', type: 'volunteer', category: 'Alimentação',
      description: 'Ajuda no preparo de marmitas aos sábados.', urgency: 4, skills: ['Cozinha'] });
    var n3 = N({ orgId: org2.id, title: 'Material escolar', type: 'material', category: 'Educação',
      description: 'Cadernos, lápis e mochilas para 80 crianças.', quantity: 80, unit: 'kits', urgency: 4 });
    var n4 = N({ orgId: org2.id, title: 'Professor voluntário de reforço', type: 'volunteer', category: 'Educação',
      description: 'Reforço de matemática e português.', urgency: 5, skills: ['Ensino', 'Programação'] });
    N({ orgId: org3.id, title: 'Ração e medicamentos', type: 'material', category: 'Animais',
      description: 'Ração e remédios para 40 animais resgatados.', quantity: 40, unit: 'animais', urgency: 3 });
    N({ orgId: org3.id, title: 'Doação financeira para castrações', type: 'financial', category: 'Animais',
      description: 'Custeio de cirurgias de castração.', urgency: 3 });
    N({ orgId: org4.id, title: 'Voluntário fisioterapeuta', type: 'volunteer', category: 'Saúde',
      description: 'Atendimento aos idosos uma vez por semana.', urgency: 4, skills: ['Enfermagem', 'Medicina'] });

    /* ---- Doações + histórico de status (mostra a transparência) ---- */
    function D(o) { o.id = o.id || id('don'); o.statusHistory = o.statusHistory || []; state.donations.push(o); return o; }
    function step(d, status, at, by, note) { d.statusHistory.push({ status: status, at: at, by: by || 'sistema', note: note || '' }); d.status = status; }

    // Doação 1: ciclo completo (Usado) — gera postagem de impacto e pontos
    var d1 = D({ donorId: marina.id, orgId: org1.id, needId: n1.id, type: 'material',
      description: '20 cestas básicas', items: [{ name: 'Cesta básica', qty: 20, unit: 'un' }],
      needsDelivery: false, createdAt: now - 9 * DAY });
    step(d1, 'Pendente', now - 9 * DAY, marina.id);
    step(d1, 'Recebido', now - 8 * DAY, ana.id, 'Recebemos com muita gratidão!');
    step(d1, 'Em estoque', now - 8 * DAY + 3600000, ana.id);
    step(d1, 'Usado', now - 5 * DAY, ana.id, 'Distribuídas para 20 famílias do bairro.');

    // Doação 2: em estoque
    var d2 = D({ donorId: carlos.id, orgId: org2.id, needId: n3.id, type: 'material',
      description: '15 kits de material escolar', items: [{ name: 'Kit escolar', qty: 15, unit: 'un' }],
      needsDelivery: false, createdAt: now - 3 * DAY });
    step(d2, 'Pendente', now - 3 * DAY, carlos.id);
    step(d2, 'Recebido', now - 2 * DAY, bruno.id);
    step(d2, 'Em estoque', now - 2 * DAY + 7200000, bruno.id);

    // Doação 3: financeira recebida
    var d3 = D({ donorId: marina.id, orgId: org3.id, needId: null, type: 'financial',
      description: 'Doação financeira', amount: 150, needsDelivery: false, createdAt: now - 1 * DAY });
    step(d3, 'Pendente', now - 1 * DAY, marina.id);
    step(d3, 'Recebido', now - 1 * DAY + 1800000, null, 'Pagamento confirmado.');
    d3.allocations = [{ id: id('alo'), description: 'Castração de 8 animais', amount: 120, note: 'Clínica VetVida', at: now - 12 * 3600000 }];

    // Doação 4: COM ENTREGA ATIVA (demonstra GPS em tempo real)
    var d4 = D({ donorId: marina.id, orgId: org1.id, needId: n1.id, type: 'material',
      description: '10 cestas básicas', items: [{ name: 'Cesta básica', qty: 10, unit: 'un' }],
      needsDelivery: true, pickup: { lat: -5.83, lng: -35.22, address: 'Rua Doadora, 10 — Ponta Negra, Natal/RN' },
      createdAt: now - 2 * 3600000 });
    step(d4, 'Pendente', now - 2 * 3600000, marina.id);
    step(d4, 'Em rota', now - 1 * 3600000, joao.id, 'Entregador João aceitou a entrega.');

    var route = buildRoute(d4.pickup, org1.location, 24);
    var del = { id: id('del'), donationId: d4.id, donorId: marina.id, orgId: org1.id, delivererId: joao.id,
      status: 'Coletado', code: '4821',
      pickup: d4.pickup, dropoff: { lat: org1.location.lat, lng: org1.location.lng, address: org1.location.address },
      route: route, routeIndex: 8, delivererLocation: { lat: route[8].lat, lng: route[8].lng, at: now - 60000 },
      createdAt: now - 1 * 3600000, acceptedAt: now - 50 * 60000, deliveredAt: null };
    state.deliveries.push(del);
    d4.delivery = del.id;

    /* ---- Postagem de impacto (liga a doação usada) ---- */
    state.posts.push({ id: id('pos'), orgId: org1.id, donationId: d1.id,
      title: '20 famílias alimentadas nesta semana 💚',
      body: 'Graças às cestas básicas doadas, conseguimos atender 20 famílias do bairro Cidade Alta. Cada cesta vira um mês de tranquilidade na mesa de quem mais precisa. Gratidão a todos os doadores!',
      image: '🍲', likes: 14, createdAt: now - 4 * DAY });
    state.posts.push({ id: id('pos'), orgId: org2.id, donationId: null,
      title: 'Volta às aulas com dignidade ✏️',
      body: 'Estamos montando os kits escolares para a criançada. Ainda precisamos de mais doações para alcançar as 80 crianças!',
      image: '🎒', likes: 8, createdAt: now - 2 * DAY });

    /* ---- Pontos de confiança (coerentes com as ações acima) ---- */
    function P(oid, amount, reason) { state.pointsLedger.push({ id: id('pts'), orgId: oid, amount: amount, reason: reason, at: now - Math.random() * 5 * DAY }); }
    var C = EP.config.points;
    P(org1.id, C.verifiedBonus, 'Organização verificada');
    P(org1.id, C.receiveDonation, 'Recebimento confirmado');
    P(org1.id, C.stockDonation, 'Item em estoque');
    P(org1.id, C.useDonation, 'Recurso utilizado');
    P(org1.id, C.impactPost, 'Postagem de impacto');
    P(org2.id, C.verifiedBonus, 'Organização verificada');
    P(org2.id, C.receiveDonation, 'Recebimento confirmado');
    P(org2.id, C.stockDonation, 'Item em estoque');
    P(org2.id, C.impactPost, 'Postagem de impacto');
    P(org4.id, C.verifiedBonus, 'Organização verificada');
    P(org3.id, C.receiveDonation, 'Recebimento confirmado');

    // recalcula trustPoints a partir do ledger
    state.organizations.forEach(function (o) {
      o.trustPoints = state.pointsLedger.filter(function (p) { return p.orgId === o.id; })
        .reduce(function (s, p) { return s + p.amount; }, 0);
    });

    /* ---- Candidatura de voluntário (laço aberto p/ a organização aceitar) ---- */
    state.applications.push({ id: id('app'), needId: n4.id, orgId: org2.id, volunteerId: carlos.id,
      message: 'Sou dev e dou aulas de matemática; tenho os sábados livres.', status: 'pendente', createdAt: now - 6 * 3600000 });

    /* ---- Notificações de exemplo (sininho) ---- */
    function NT(userId, text, icon, link, read, at) {
      state.notifications.push({ id: id('not'), userId: userId, text: text, icon: icon || '🔔', link: link || '', read: !!read, createdAt: at || now });
    }
    NT(marina.id, 'Casa do Bem marcou sua doação como "Usado" ✅', '✅', '#/doacao/' + d1.id, false, now - 5 * DAY);
    NT(marina.id, 'Casa do Bem publicou o impacto da sua doação 💚', '📣', '#/org/' + org1.id, true, now - 4 * DAY);
    NT(marina.id, 'Seu pedido de entrega foi aceito por João Mota 🛵', '🛵', '#/doacao/' + d4.id, false, now - 50 * 60000);
    NT(bruno.id, 'Carlos Lima candidatou-se: "Professor voluntário de reforço" 🙋', '🙋', '#/painel?tab=org', false, now - 6 * 3600000);

    state.meta.seededAt = now;
  }

  /* Gera uma sequência de pontos interpolando do início ao fim (rota fake). */
  function buildRoute(a, b, steps) {
    steps = steps || 20;
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      // leve curvatura para parecer uma rua, não uma linha reta
      var wobble = Math.sin(t * Math.PI) * 0.004;
      pts.push({
        lat: a.lat + (b.lat - a.lat) * t + wobble,
        lng: a.lng + (b.lng - a.lng) * t - wobble * 0.6,
      });
    }
    return pts;
  }

  return {
    load: load, save: save, reset: reset, id: id,
    all: all, get: get, query: query, insert: insert, update: update, remove: remove,
    userByEmail: userByEmail, orgById: orgById, orgOfUser: orgOfUser,
    needsOfOrg: needsOfOrg, donationsForOrg: donationsForOrg, donationsForDonor: donationsForDonor,
    postsForOrg: postsForOrg, buildRoute: buildRoute,
  };
})();
