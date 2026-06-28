/* =============================================================================
 * supa.js — Integração com o Supabase (backend real)
 * -----------------------------------------------------------------------------
 * Estratégia: cada coleção do app vira uma tabela (id text, doc jsonb). No boot,
 * tudo é baixado para um cache em memória (EP.db), mantendo o app síncrono. As
 * escritas sobem por registro e o Realtime sincroniza entre dispositivos.
 * Ativo apenas quando EP.config.backend.mode === 'supabase'.
 * ========================================================================== */
window.EP = window.EP || {};

EP.supa = (function () {
  // coleção (app)  ->  tabela (Postgres)
  var TABLES = {
    users: 'users', organizations: 'organizations', needs: 'needs',
    donations: 'donations', deliveries: 'deliveries', posts: 'posts',
    pointsLedger: 'points_ledger', applications: 'applications', notifications: 'notifications',
  };
  var COLLS = Object.keys(TABLES);
  var client = null;
  var channel = null;
  var muted = false;   // silencia o Realtime durante reseed/limpeza (evita corrida)
  function isMuted() { return muted; }

  function active() { return !!(EP.config.backend && EP.config.backend.mode === 'supabase'); }

  function create() {
    if (client) return client;
    var b = EP.config.backend;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca supabase-js não carregada (sem internet?).');
    client = window.supabase.createClient(b.url, b.anonKey, { realtime: { params: { eventsPerSecond: 20 } } });
    return client;
  }

  /* ---- Carrega todas as tabelas para o formato de estado do app --------- */
  async function loadAll() {
    var state = {};
    for (var i = 0; i < COLLS.length; i++) {
      var coll = COLLS[i];
      var res = await client.from(TABLES[coll]).select('id, doc');
      if (res.error) { var e = new Error(res.error.message); e.code = res.error.code; e.coll = coll; throw e; }
      state[coll] = (res.data || []).map(function (r) { return r.doc; });
    }
    return state;
  }

  /* ---- Escreve um registro (upsert) ou remove -------------------------- */
  async function push(coll, op, payload) {
    if (!client || !TABLES[coll]) return;
    try {
      if (op === 'delete') await client.from(TABLES[coll]).delete().eq('id', payload.id);
      else await client.from(TABLES[coll]).upsert({ id: payload.id, doc: payload });
    } catch (e) { console.error('[supa] push', coll, e); }
  }

  /* ---- Sobe um estado inteiro (usado na primeira semeadura) ------------- */
  async function pushAll(state) {
    for (var i = 0; i < COLLS.length; i++) {
      var coll = COLLS[i];
      var rows = (state[coll] || []).map(function (o) { return { id: o.id, doc: o }; });
      if (rows.length) {
        var res = await client.from(TABLES[coll]).upsert(rows);
        if (res.error) throw new Error('Falha ao semear ' + coll + ': ' + res.error.message);
      }
    }
  }

  /* ---- Apaga tudo (admin/reset) ---------------------------------------- */
  async function clearAll() {
    for (var i = 0; i < COLLS.length; i++) {
      try { await client.from(TABLES[COLLS[i]]).delete().neq('id', '___none___'); } catch (e) {}
    }
  }

  /* ---- Assina mudanças em tempo real ----------------------------------- */
  function subscribe(onChange) {
    if (channel) { try { client.removeChannel(channel); } catch (e) {} }
    channel = client.channel('elo-realtime');
    COLLS.forEach(function (coll) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[coll] }, function (payload) {
        onChange(coll, payload);
      });
    });
    channel.subscribe();
    return channel;
  }

  /* ---- Reseed seguro: limpa, regrava o seed e recarrega do banco -------- */
  async function reseed() {
    create();
    muted = true;                                   // ignora ecos do Realtime durante a operação
    try {
      var seed = JSON.parse(JSON.stringify(EP.db.buildSeedState())); // cópia imutável p/ o upload
      await clearAll();
      await pushAll(seed);
      var state = await loadAll();                   // fonte da verdade após gravar
      EP.db.setState(state);
      return state;
    } finally { muted = false; }
  }
  async function clearData() {
    create();
    muted = true;
    try { await clearAll(); EP.db.setState(null); return EP.db.load(); }
    finally { muted = false; }
  }

  /* ---- Inicializa: cria cliente, carrega (semeia se vazio) -------------- */
  async function init() {
    create();
    var state = await loadAll();
    var total = COLLS.reduce(function (s, c) { return s + (state[c] ? state[c].length : 0); }, 0);
    var seeded = false;
    if (total === 0) {
      var seedState = EP.db.buildSeedState();   // usa a mesma lógica de seed do modo local
      await pushAll(seedState);
      state = seedState;
      seeded = true;
    }
    return { state: state, seeded: seeded };
  }

  return {
    active: active, create: create, init: init, loadAll: loadAll,
    push: push, pushAll: pushAll, clearAll: clearAll, clearData: clearData,
    reseed: reseed, subscribe: subscribe, isMuted: isMuted,
    TABLES: TABLES, COLLS: COLLS, client: function () { return client; },
  };
})();
