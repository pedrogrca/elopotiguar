/* =============================================================================
 * logic.js — Regras de negócio
 *  - Pontos de confiança e níveis de credibilidade
 *  - Ciclo de vida da doação (status + transparência)
 *  - Entregas estilo iFood (código + GPS)
 *  - Algoritmo de matching voluntário <-> necessidades
 * ========================================================================== */
window.EP = window.EP || {};

EP.logic = (function () {
  var C = EP.config;

  /* ===================== PONTOS DE CONFIANÇA ============================= */
  function trustTier(points) {
    var tier = C.trustTiers[0];
    C.trustTiers.forEach(function (t) { if (points >= t.min) tier = t; });
    return tier;
  }

  function awardPoints(orgId, amount, reason, ref) {
    if (!amount) return;
    EP.db.insert('pointsLedger', { orgId: orgId, amount: amount, reason: reason, refId: ref || null, at: Date.now() });
    var org = EP.db.orgById(orgId);
    if (org) EP.db.update('organizations', orgId, { trustPoints: (org.trustPoints || 0) + amount });
    EP.bus.emit('points:changed', { orgId: orgId, amount: amount });
    EP.bus.emit('org:changed', { orgId: orgId });
  }

  function pointsLog(orgId) {
    return EP.db.query('pointsLedger', function (p) { return p.orgId === orgId; })
      .sort(function (a, b) { return b.at - a.at; });
  }

  /* ===================== STATUS DE DOAÇÃO =============================== */
  function statusMeta(key) {
    return C.donationStatuses.find(function (s) { return s.key === key; }) || { key: key, label: key, color: '#888', icon: '•' };
  }

  // status que a organização pode aplicar manualmente, na ordem
  var ORG_FLOW = ['Recebido', 'Em estoque', 'Usado'];
  var STATUS_POINTS = {
    'Recebido': C.points.receiveDonation,
    'Em estoque': C.points.stockDonation,
    'Usado': C.points.useDonation,
  };

  // doações financeiras não passam por "Em estoque"
  function flowFor(donation) {
    return donation.type === 'financial' ? ['Recebido', 'Usado'] : ORG_FLOW;
  }

  function nextOrgStatuses(donation) {
    var flow = flowFor(donation);
    if (donation.status === 'Pendente' || donation.status === 'Em rota') return [flow[0]];
    var idx = flow.indexOf(donation.status);
    if (idx < 0) return [];
    return flow.slice(idx + 1);
  }

  function advanceDonation(donationId, status, byUserId, note) {
    var d = EP.db.get('donations', donationId);
    if (!d) return null;
    d.statusHistory = d.statusHistory || [];
    d.statusHistory.push({ status: status, at: Date.now(), by: byUserId || 'sistema', note: note || '' });
    d.status = status;
    EP.db.save();
    if (STATUS_POINTS[status]) awardPoints(d.orgId, STATUS_POINTS[status], 'Doação: ' + status, donationId);
    var org = EP.db.orgById(d.orgId);
    notify(d.donorId, 'Sua doação para ' + (org ? org.name : 'a organização') + ' agora está: ' + statusMeta(status).icon + ' ' + status, statusMeta(status).icon, '#/doacao/' + donationId);
    EP.bus.emit('donation:changed', { donationId: donationId, status: status });
    return d;
  }

  function createDonation(data) {
    var user = EP.auth.currentUser();
    if (!user) throw new Error('Faça login para doar.');
    var org = EP.db.orgById(data.orgId);
    if (!org) throw new Error('Organização inválida.');

    var d = EP.db.insert('donations', {
      donorId: user.id, orgId: data.orgId, needId: data.needId || null,
      type: data.type, description: data.description || '',
      items: data.items || [], amount: data.amount || 0,
      needsDelivery: !!data.needsDelivery,
      pickup: data.pickup || null,
      status: 'Pendente', delivery: null,
      statusHistory: [{ status: 'Pendente', at: Date.now(), by: user.id, note: 'Doação registrada.' }],
    });

    if (data.needsDelivery && data.type === 'material') {
      var del = createDelivery(d, org);
      d.delivery = del.id;
      EP.db.save();
    }
    var owner = orgOwnerId(org.id);
    if (owner) notify(owner, 'Nova doação de ' + user.name + ': ' + (d.type === 'financial' ? C.currency(d.amount) : d.description), '📦', '#/painel?tab=org');
    if (d.delivery) notifyDeliverers('Nova entrega disponível para ' + org.name + ' 🛵', '🛵', '#/painel?tab=deliverer');
    EP.bus.emit('donation:changed', { donationId: d.id });
    return d;
  }

  /* ===================== ENTREGAS (iFood-style) ========================= */
  function genCode() { return ('' + Math.floor(1000 + Math.random() * 9000)); }

  function createDelivery(donation, org) {
    var pickup = donation.pickup || { lat: C.map.center.lat - 0.03, lng: C.map.center.lng - 0.01, address: 'Endereço do doador' };
    var dropoff = { lat: org.location.lat, lng: org.location.lng, address: org.location.address };
    var del = EP.db.insert('deliveries', {
      donationId: donation.id, donorId: donation.donorId, orgId: org.id, delivererId: null,
      status: 'Aguardando', code: genCode(),
      pickup: pickup, dropoff: dropoff,
      route: EP.db.buildRoute(pickup, dropoff, 24), routeIndex: 0,
      delivererLocation: null, acceptedAt: null, deliveredAt: null,
    });
    EP.bus.emit('delivery:changed', { deliveryId: del.id });
    return del;
  }

  function openDeliveries() {
    return EP.db.query('deliveries', function (d) { return d.status === 'Aguardando' && !d.delivererId; });
  }

  function acceptDelivery(deliveryId, delivererId) {
    var del = EP.db.get('deliveries', deliveryId);
    if (!del) throw new Error('Entrega não encontrada.');
    if (del.delivererId) throw new Error('Esta entrega já foi aceita por outro entregador.');
    del.delivererId = delivererId;
    del.status = 'Aceita';
    del.acceptedAt = Date.now();
    del.routeIndex = 0;
    del.delivererLocation = { lat: del.route[0].lat, lng: del.route[0].lng, at: Date.now() };
    EP.db.save();
    advanceDonation(del.donationId, 'Em rota', delivererId, 'Entregador a caminho da coleta.');
    var deliverer = EP.db.get('users', delivererId);
    notify(del.donorId, (deliverer ? deliverer.name : 'Um entregador') + ' aceitou sua entrega e está a caminho! 🛵', '🛵', '#/doacao/' + del.donationId);
    var oid = orgOwnerId(del.orgId); if (oid) notify(oid, 'Entregador a caminho da coleta 🛵', '🛵', '#/painel?tab=org');
    EP.bus.emit('delivery:changed', { deliveryId: del.id });
    return del;
  }

  function setDeliveryStatus(deliveryId, status) {
    var del = EP.db.get('deliveries', deliveryId);
    if (!del) return null;
    del.status = status;
    EP.db.save();
    EP.bus.emit('delivery:changed', { deliveryId: del.id });
    return del;
  }

  function updateDelivererLocation(deliveryId, lat, lng, routeIndex) {
    var del = EP.db.get('deliveries', deliveryId);
    if (!del) return null;
    del.delivererLocation = { lat: lat, lng: lng, at: Date.now() };
    if (routeIndex != null) del.routeIndex = routeIndex;
    EP.db.save();
    EP.bus.emit('delivery:moved', { deliveryId: del.id, lat: lat, lng: lng, at: del.delivererLocation.at });
    return del;
  }

  function confirmDelivery(deliveryId, code) {
    var del = EP.db.get('deliveries', deliveryId);
    if (!del) throw new Error('Entrega não encontrada.');
    if (String(code).trim() !== String(del.code)) throw new Error('Código incorreto. Confira com quem está recebendo.');
    del.status = 'Entregue';
    del.deliveredAt = Date.now();
    if (del.route && del.route.length) {
      var end = del.route[del.route.length - 1];
      del.delivererLocation = { lat: end.lat, lng: end.lng, at: Date.now() };
      del.routeIndex = del.route.length - 1;
    }
    EP.db.save();
    advanceDonation(del.donationId, 'Recebido', del.delivererId, 'Entrega confirmada pelo código de segurança.');
    notify(del.donorId, 'Sua doação foi entregue e recebida pela organização ✅', '✅', '#/doacao/' + del.donationId);
    var oid2 = orgOwnerId(del.orgId); if (oid2) notify(oid2, 'Entrega concluída e confirmada por código ✅', '✅', '#/painel?tab=org');
    EP.bus.emit('delivery:changed', { deliveryId: del.id });
    return del;
  }

  /* ===================== POSTAGENS DE IMPACTO =========================== */
  function createPost(orgId, data) {
    var post = EP.db.insert('posts', {
      orgId: orgId, donationId: data.donationId || null,
      title: data.title, body: data.body, image: data.image || '📣', likes: 0,
    });
    awardPoints(orgId, C.points.impactPost, 'Postagem de impacto', post.id);
    if (post.donationId) {
      var linked = EP.db.get('donations', post.donationId);
      var org = EP.db.orgById(orgId);
      if (linked) notify(linked.donorId, (org ? org.name : 'A organização') + ' publicou o impacto da sua doação 💚', '📣', '#/org/' + orgId);
    }
    EP.bus.emit('post:changed', { postId: post.id });
    return post;
  }

  function feed() {
    return EP.db.all('posts').slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  /* ===================== NOTIFICAÇÕES ================================== */
  function orgOwnerId(orgId) {
    var o = EP.db.orgById(orgId);
    if (o && o.ownerId) return o.ownerId;
    var u = EP.db.query('users', function (x) { return x.orgId === orgId; })[0];
    return u ? u.id : null;
  }
  function notify(userId, text, icon, link) {
    if (!userId) return;
    EP.db.insert('notifications', { userId: userId, text: text, icon: icon || '🔔', link: link || '', read: false });
    EP.bus.emit('notif:changed', { userId: userId });
  }
  function notifyDeliverers(text, icon, link) {
    EP.db.query('users', function (u) { return u.roles.indexOf('deliverer') >= 0; }).forEach(function (u) { notify(u.id, text, icon, link); });
  }
  function notificationsFor(userId) {
    return EP.db.query('notifications', function (n) { return n.userId === userId; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function unreadCount(userId) {
    return EP.db.query('notifications', function (n) { return n.userId === userId && !n.read; }).length;
  }
  function markAllRead(userId) {
    EP.db.all('notifications').forEach(function (n) { if (n.userId === userId) n.read = true; });
    EP.db.save();
    EP.bus.emit('notif:changed', { userId: userId });
  }

  /* ===================== CANDIDATURAS DE VOLUNTÁRIO ==================== */
  function hasApplied(needId, volId) {
    return EP.db.query('applications', function (a) { return a.needId === needId && a.volunteerId === volId; }).length > 0;
  }
  function applyToNeed(needId, volId, message) {
    if (hasApplied(needId, volId)) throw new Error('Você já se candidatou a esta vaga.');
    var need = EP.db.get('needs', needId);
    if (!need) throw new Error('Necessidade não encontrada.');
    var app = EP.db.insert('applications', { needId: needId, orgId: need.orgId, volunteerId: volId, message: message || '', status: 'pendente' });
    var vol = EP.db.get('users', volId);
    var owner = orgOwnerId(need.orgId);
    if (owner) notify(owner, (vol ? vol.name : 'Voluntário') + ' candidatou-se: "' + need.title + '" 🙋', '🙋', '#/painel?tab=org');
    EP.bus.emit('application:changed', { appId: app.id });
    return app;
  }
  function applicationsForOrg(orgId) {
    return EP.db.query('applications', function (a) { return a.orgId === orgId; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function applicationsForVolunteer(volId) {
    return EP.db.query('applications', function (a) { return a.volunteerId === volId; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function respondApplication(appId, status) {
    var app = EP.db.update('applications', appId, { status: status });
    if (app) {
      var need = EP.db.get('needs', app.needId);
      var org = EP.db.orgById(app.orgId);
      notify(app.volunteerId, 'Sua candidatura para "' + (need ? need.title : '') + '" foi ' + (status === 'aceita' ? 'ACEITA ✅' : 'recusada') + ' por ' + (org ? org.name : ''), status === 'aceita' ? '✅' : '🙅', '#/painel?tab=volunteer');
      EP.bus.emit('application:changed', { appId: appId });
    }
    return app;
  }

  /* ===================== ALOCAÇÃO FINANCEIRA ========================== */
  function addAllocation(donationId, alloc) {
    var d = EP.db.get('donations', donationId);
    if (!d) return null;
    d.allocations = d.allocations || [];
    d.allocations.push({ id: EP.db.id('alo'), description: alloc.description, amount: Number(alloc.amount) || 0, note: alloc.note || '', at: Date.now() });
    EP.db.save();
    var org = EP.db.orgById(d.orgId);
    notify(d.donorId, (org ? org.name : 'A organização') + ' detalhou o uso da sua doação: ' + alloc.description, '💰', '#/doacao/' + donationId);
    EP.bus.emit('donation:changed', { donationId: donationId });
    return d;
  }
  function allocationSummary(d) {
    var total = d.amount || 0;
    var used = (d.allocations || []).reduce(function (s, a) { return s + (a.amount || 0); }, 0);
    return { total: total, used: used, remaining: Math.max(0, total - used) };
  }

  /* ===================== RANKING / PRIORIZAÇÃO ========================== */
  function orgRanking() {
    return EP.db.all('organizations').slice().sort(function (a, b) { return (b.trustPoints || 0) - (a.trustPoints || 0); });
  }

  // Prioriza organizações mais vulneráveis (e com necessidades urgentes)
  function prioritizedOrgs() {
    return EP.db.all('organizations').slice().map(function (o) {
      var needs = EP.db.needsOfOrg(o.id).filter(function (n) { return n.status === 'open'; });
      var maxUrg = needs.reduce(function (m, n) { return Math.max(m, n.urgency || 0); }, 0);
      return { org: o, needs: needs, priority: (o.vulnerability || 0) * 10 + maxUrg };
    }).sort(function (a, b) { return b.priority - a.priority; });
  }

  /* ===================== MATCHING ====================================== */
  // Pontua o quão boa é uma necessidade (de voluntário) para um usuário
  function scoreNeed(user, need, org) {
    var w = C.matching, score = 0, reasons = [];
    var uSkills = user.skills || [], uInterests = user.interests || [];

    var skillHits = (need.skills || []).filter(function (s) { return uSkills.indexOf(s) >= 0; });
    if (skillHits.length) { score += skillHits.length * w.wSkill; reasons.push('Habilidade: ' + skillHits.join(', ')); }

    if (uInterests.indexOf(org.category) >= 0 || uInterests.indexOf(need.category) >= 0) {
      score += w.wInterest; reasons.push('Interesse em ' + need.category);
    }
    if (need.urgency) score += need.urgency * w.wUrgency;
    if (org.vulnerability) score += org.vulnerability * w.wVulnerability;

    if (user.location && org.city && user.location.city &&
        user.location.city.toLowerCase() === org.city.toLowerCase()) {
      score += w.wLocation; reasons.push('Mesma cidade (' + org.city + ')');
    }
    return { score: score, reasons: reasons, skillHits: skillHits };
  }

  function matchesForUser(user) {
    if (!user) return [];
    var volunteerNeeds = EP.db.query('needs', function (n) { return n.type === 'volunteer' && n.status === 'open'; });
    return volunteerNeeds.map(function (n) {
      var org = EP.db.orgById(n.orgId);
      var s = scoreNeed(user, n, org);
      return { need: n, org: org, score: s.score, reasons: s.reasons, skillHits: s.skillHits };
    }).filter(function (m) { return m.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  // Recomenda organizações a um doador conforme seus interesses
  function recommendOrgs(user) {
    var interests = (user && user.interests) || [];
    return prioritizedOrgs().map(function (p) {
      var bonus = interests.indexOf(p.org.category) >= 0 ? 100 : 0;
      return Object.assign({}, p, { priority: p.priority + bonus });
    }).sort(function (a, b) { return b.priority - a.priority; });
  }

  /* ===================== ESTATÍSTICAS ================================== */
  function globalStats() {
    var dons = EP.db.all('donations');
    return {
      orgs: EP.db.all('organizations').length,
      donations: dons.length,
      completed: dons.filter(function (d) { return d.status === 'Usado'; }).length,
      volunteers: EP.db.query('users', function (u) { return u.roles.indexOf('volunteer') >= 0; }).length,
      totalFinancial: dons.filter(function (d) { return d.type === 'financial'; }).reduce(function (s, d) { return s + (d.amount || 0); }, 0),
    };
  }

  return {
    trustTier: trustTier, awardPoints: awardPoints, pointsLog: pointsLog,
    statusMeta: statusMeta, nextOrgStatuses: nextOrgStatuses, advanceDonation: advanceDonation, createDonation: createDonation,
    createDelivery: createDelivery, openDeliveries: openDeliveries, acceptDelivery: acceptDelivery,
    setDeliveryStatus: setDeliveryStatus, updateDelivererLocation: updateDelivererLocation, confirmDelivery: confirmDelivery,
    createPost: createPost, feed: feed,
    orgRanking: orgRanking, prioritizedOrgs: prioritizedOrgs,
    matchesForUser: matchesForUser, recommendOrgs: recommendOrgs, scoreNeed: scoreNeed,
    globalStats: globalStats, ORG_FLOW: ORG_FLOW, flowFor: flowFor,
    // notificações
    notify: notify, notifyDeliverers: notifyDeliverers, notificationsFor: notificationsFor,
    unreadCount: unreadCount, markAllRead: markAllRead, orgOwnerId: orgOwnerId,
    // candidaturas
    applyToNeed: applyToNeed, hasApplied: hasApplied, applicationsForOrg: applicationsForOrg,
    applicationsForVolunteer: applicationsForVolunteer, respondApplication: respondApplication,
    // alocação financeira
    addAllocation: addAllocation, allocationSummary: allocationSummary,
  };
})();
