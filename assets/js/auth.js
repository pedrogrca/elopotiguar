/* =============================================================================
 * auth.js — Cadastro, login, sessão e direitos do titular (LGPD)
 * -----------------------------------------------------------------------------
 * Segurança da senha:
 *  - Cadastros reais usam PBKDF2-HMAC-SHA256 (Web Crypto), 150k iterações e
 *    salt aleatório por usuário. A senha nunca é armazenada em texto.
 *  - As contas de DEMONSTRAÇÃO usam um hash legado (síncrono) só para semear —
 *    o login aceita os dois formatos (campo passwordAlgo).
 *  - Em produção (Supabase), a verificação deve ir para o servidor (bcrypt via
 *    RPC + RLS), ver supabase/secure-auth.sql.
 * ========================================================================== */
window.EP = window.EP || {};

EP.auth = (function () {
  var SESSION_KEY = (EP.config && EP.config.sessionKey) || 'elo_potiguar_session_v1';
  var PBKDF2_ITER = 150000;
  var current = undefined; // cache

  /* ---- util ------------------------------------------------------------- */
  function cryptoOk() { return !!(window.crypto && window.crypto.subtle && window.TextEncoder); }
  function bufToHex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
  }
  function hexToBytes(hex) {
    var a = new Uint8Array(hex.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
    return a;
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return bufToHex(a.buffer || a);
  }
  // comparação de tempo ~constante (evita timing attacks)
  function safeEqual(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* ---- Hash legado (apenas contas de demonstração) --------------------- */
  function hashSync(password, salt) {
    var input = salt + '::' + password + '::elo';
    var h = 2166136261 >>> 0;
    for (var r = 0; r < 5000; r++) {
      for (var i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      input = h.toString(16) + salt;
    }
    return ('00000000' + h.toString(16)).slice(-8) + ':' + salt;
  }
  function makeSalt() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

  /* ---- PBKDF2 (cadastros reais) ---------------------------------------- */
  async function pbkdf2(password, saltBytes, iterations) {
    var enc = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' }, keyMaterial, 256);
    return bufToHex(bits);
  }
  // retorna as credenciais a serem guardadas (sem a senha em claro)
  async function hashPassword(password) {
    if (cryptoOk()) {
      var salt = randomHex(16);
      var hash = await pbkdf2(password, hexToBytes(salt), PBKDF2_ITER);
      return { passwordAlgo: 'pbkdf2', salt: salt, iterations: PBKDF2_ITER, passwordHash: hash };
    }
    var s = makeSalt();
    return { passwordAlgo: 'fnv', salt: s, iterations: 0, passwordHash: hashSync(password, s) };
  }
  async function verifyPassword(password, cred) {
    if (cred && cred.passwordAlgo === 'pbkdf2') {
      var h = await pbkdf2(password, hexToBytes(cred.salt), cred.iterations || PBKDF2_ITER);
      return safeEqual(h, cred.passwordHash);
    }
    // legado/demonstração
    return safeEqual(hashSync(password, cred.salt), cred.passwordHash);
  }

  /* ---- Política e força de senha --------------------------------------- */
  function passwordIssues(pw) {
    pw = pw || '';
    var issues = [];
    if (pw.length < 8) issues.push('Use ao menos 8 caracteres');
    if (!/[A-Za-zÀ-ÿ]/.test(pw)) issues.push('Inclua ao menos uma letra');
    if (!/[0-9]/.test(pw)) issues.push('Inclua ao menos um número');
    if (/^(?:123456|senha|password|123456789|qwerty|111111)$/i.test(pw)) issues.push('Evite senhas comuns');
    return issues;
  }
  function passwordStrength(pw) {
    pw = pw || '';
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    s = Math.min(4, s);
    var map = [
      { label: 'Muito fraca', color: '#d64545' },
      { label: 'Fraca', color: '#e07b39' },
      { label: 'Razoável', color: '#f4a531' },
      { label: 'Boa', color: '#2f6fed' },
      { label: 'Forte', color: '#0e7c66' },
    ];
    return { score: s, label: map[s].label, color: map[s].color };
  }

  /* ---- Cadastro (assíncrono) ------------------------------------------- */
  async function register(data) {
    var email = String(data.email || '').toLowerCase().trim();
    if (!data.name || !data.name.trim()) throw new Error('Informe seu nome.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
    var pwIssues = passwordIssues(data.password);
    if (pwIssues.length) throw new Error('Senha fraca: ' + pwIssues.join('; ') + '.');
    if (!data.consent) throw new Error('É necessário aceitar a Política de Privacidade e os Termos de Uso (LGPD).');
    if (EP.db.userByEmail(email)) throw new Error('Já existe uma conta com este e-mail.');
    var roles = (data.roles && data.roles.length) ? data.roles : ['donor'];

    var cred = await hashPassword(data.password);
    var legal = (EP.config && EP.config.legal) || {};
    var user = {
      name: data.name.trim(), email: email,
      passwordAlgo: cred.passwordAlgo, passwordHash: cred.passwordHash, salt: cred.salt, iterations: cred.iterations,
      roles: roles, orgId: null,
      skills: data.skills || [], interests: data.interests || [],
      availability: data.availability || '', bio: data.bio || '',
      location: data.location || { city: '', lat: null, lng: null },
      consent: { accepted: true, at: Date.now(), privacyVersion: legal.privacyVersion || '1.0', termsVersion: legal.termsVersion || '1.0' },
    };
    EP.db.insert('users', user);

    if (roles.indexOf('org') >= 0 && data.org) {
      var org = EP.db.insert('organizations', {
        name: data.org.name, category: data.org.category || EP.config.categories[0],
        city: data.org.city || '', description: data.org.description || '',
        vulnerability: Number(data.org.vulnerability) || 3, verified: false,
        location: data.org.location || { lat: EP.config.map.center.lat, lng: EP.config.map.center.lng, address: data.org.address || '' },
        ownerId: user.id, trustPoints: 0,
      });
      EP.db.update('users', user.id, { orgId: org.id });
      user.orgId = org.id;
    }

    if (roles.indexOf('company') >= 0 && data.company) {
      user.company = { name: data.company.name || user.name, sector: data.company.sector || '', cnpj: data.company.cnpj || '', logo: data.company.logo || '' };
      EP.db.update('users', user.id, { company: user.company });
    }

    setSession(user.id);
    return user;
  }

  /* ---- Login (assíncrono) ---------------------------------------------- */
  async function login(email, password) {
    var user = EP.db.userByEmail(email);
    // mensagem genérica (anti-enumeração de usuários)
    var fail = new Error('E-mail ou senha incorretos.');
    if (!user) { await delay(120); throw fail; }
    var ok = await verifyPassword(password, user);
    if (!ok) throw fail;
    setSession(user.id);
    return user;
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    current = null;
    EP.bus && EP.bus.emit('auth:changed', null);
  }

  /* ---- Sessão ----------------------------------------------------------- */
  function setSession(userId) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: userId, at: Date.now() })); } catch (e) {}
    current = undefined;
    EP.bus && EP.bus.emit('auth:changed', userId);
  }
  function currentUser() {
    if (current !== undefined) return current;
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      var sess = raw ? JSON.parse(raw) : null;
      current = sess ? EP.db.get('users', sess.userId) : null;
    } catch (e) { current = null; }
    return current;
  }
  function refresh() { current = undefined; return currentUser(); }
  function hasRole(role) { var u = currentUser(); return !!(u && u.roles && u.roles.indexOf(role) >= 0); }
  function isLoggedIn() { return !!currentUser(); }

  /* ---- LGPD: acesso e exclusão dos dados do titular -------------------- */
  // Remove campos sensíveis antes de qualquer exposição.
  function publicProfile(u) {
    if (!u) return null;
    var c = JSON.parse(JSON.stringify(u));
    delete c.passwordHash; delete c.salt; delete c.iterations; delete c.passwordAlgo;
    return c;
  }
  // Direito de acesso/portabilidade: exporta todos os dados do titular.
  function exportData(userId) {
    var u = EP.db.get('users', userId);
    if (!u) return null;
    return {
      geradoEm: new Date().toISOString(),
      perfil: publicProfile(u),
      organizacao: u.orgId ? EP.db.get('organizations', u.orgId) : null,
      doacoes: EP.db.query('donations', function (d) { return d.donorId === userId; }),
      candidaturas: EP.db.query('applications', function (a) { return a.volunteerId === userId; }),
      notificacoes: EP.db.query('notifications', function (n) { return n.userId === userId; }),
    };
  }
  // Direito de eliminação: remove dados pessoais e anonimiza o histórico.
  function deleteAccount(userId) {
    var u = EP.db.get('users', userId);
    if (!u) return false;
    // anonimiza doações (preserva a transparência da organização, sem dado pessoal)
    EP.db.query('donations', function (d) { return d.donorId === userId; }).forEach(function (d) {
      EP.db.update('donations', d.id, { donorId: 'anon', anonimizado: true });
    });
    EP.db.query('applications', function (a) { return a.volunteerId === userId; }).forEach(function (a) { EP.db.remove('applications', a.id); });
    EP.db.query('notifications', function (n) { return n.userId === userId; }).forEach(function (n) { EP.db.remove('notifications', n.id); });
    if (u.orgId) { var org = EP.db.get('organizations', u.orgId); if (org && org.ownerId === userId) EP.db.update('organizations', u.orgId, { ownerId: null }); }
    EP.db.remove('users', userId);
    logout();
    return true;
  }

  return {
    hashSync: hashSync, register: register, login: login, logout: logout,
    currentUser: currentUser, refresh: refresh, hasRole: hasRole,
    isLoggedIn: isLoggedIn, setSession: setSession,
    passwordIssues: passwordIssues, passwordStrength: passwordStrength,
    publicProfile: publicProfile, exportData: exportData, deleteAccount: deleteAccount,
  };
})();
