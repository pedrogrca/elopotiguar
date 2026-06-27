/* =============================================================================
 * auth.js — Cadastro, login e sessão
 * -----------------------------------------------------------------------------
 * O hash de senha aqui é DIDÁTICO (síncrono, sem dependências) — adequado para
 * um app local de demonstração. Em produção, troque por bcrypt/argon2 no
 * servidor. A função hashSync é usada também para semear os dados de exemplo.
 * ========================================================================== */
window.EP = window.EP || {};

EP.auth = (function () {
  var SESSION_KEY = (EP.config && EP.config.sessionKey) || 'elo_potiguar_session_v1';
  var current = undefined; // cache

  /* ---- Hash síncrono (FNV-1a + rounds com salt) — apenas demonstração --- */
  function hashSync(password, salt) {
    var input = salt + '::' + password + '::elo';
    var h = 2166136261 >>> 0;
    for (var r = 0; r < 5000; r++) {        // "rounds" para encarecer um pouco
      for (var i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      input = h.toString(16) + salt;
    }
    return ('00000000' + h.toString(16)).slice(-8) + ':' + salt;
  }

  function makeSalt() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

  /* ---- Cadastro --------------------------------------------------------- */
  function register(data) {
    var email = String(data.email || '').toLowerCase().trim();
    if (!data.name || !data.name.trim()) throw new Error('Informe seu nome.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
    if (!data.password || data.password.length < 4) throw new Error('A senha deve ter ao menos 4 caracteres.');
    if (EP.db.userByEmail(email)) throw new Error('Já existe uma conta com este e-mail.');
    var roles = (data.roles && data.roles.length) ? data.roles : ['donor'];

    var salt = makeSalt();
    var user = {
      name: data.name.trim(), email: email,
      passwordHash: hashSync(data.password, salt), salt: salt,
      roles: roles, orgId: null,
      skills: data.skills || [], interests: data.interests || [],
      availability: data.availability || '', bio: data.bio || '',
      location: data.location || { city: '', lat: null, lng: null },
    };
    EP.db.insert('users', user);

    // Se for organização, cria a organização vinculada
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

    setSession(user.id);
    return user;
  }

  /* ---- Login ------------------------------------------------------------ */
  function login(email, password) {
    var user = EP.db.userByEmail(email);
    if (!user) throw new Error('E-mail ou senha incorretos.');
    var attempt = hashSync(password, user.salt);
    if (attempt !== user.passwordHash) throw new Error('E-mail ou senha incorretos.');
    setSession(user.id);
    return user;
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    current = null;
    EP.bus && EP.bus.emit('auth:changed', null);
  }

  /* ---- Sessão ----------------------------------------------------------- */
  function setSession(userId) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: userId, at: Date.now() })); } catch (e) {}
    current = undefined; // invalida cache
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

  function hasRole(role) {
    var u = currentUser();
    return !!(u && u.roles && u.roles.indexOf(role) >= 0);
  }

  function isLoggedIn() { return !!currentUser(); }

  return {
    hashSync: hashSync, register: register, login: login, logout: logout,
    currentUser: currentUser, refresh: refresh, hasRole: hasRole,
    isLoggedIn: isLoggedIn, setSession: setSession,
  };
})();
