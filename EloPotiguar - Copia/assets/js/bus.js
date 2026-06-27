/* =============================================================================
 * bus.js — Barramento de eventos em tempo real
 * -----------------------------------------------------------------------------
 * Combina três mecanismos para garantir atualização "ao vivo" (GPS, status):
 *   1. Listeners locais (mesma aba)               -> sempre funciona
 *   2. BroadcastChannel (entre abas, mesma origem) -> melhor experiência
 *   3. window 'storage' event (fallback entre abas)
 *
 * Use EP.bus.emit('delivery:moved', payload) e EP.bus.on('delivery:moved', fn).
 * ========================================================================== */
window.EP = window.EP || {};

EP.bus = (function () {
  var listeners = {};
  var channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('elo_potiguar');
  } catch (e) { channel = null; }

  if (channel) {
    channel.onmessage = function (ev) {
      var d = ev.data || {};
      dispatch(d.type, d.payload, true);
    };
  }

  // Fallback entre abas via evento de storage (quando BroadcastChannel indisponível)
  window.addEventListener('storage', function (e) {
    if (e.key === '__elo_bus__' && e.newValue) {
      try {
        var d = JSON.parse(e.newValue);
        dispatch(d.type, d.payload, true);
      } catch (err) {}
    }
  });

  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    return function off() {
      listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; });
    };
  }

  function dispatch(type, payload, remote) {
    (listeners[type] || []).forEach(function (fn) {
      try { fn(payload, remote); } catch (e) { console.error(e); }
    });
    (listeners['*'] || []).forEach(function (fn) {
      try { fn({ type: type, payload: payload }, remote); } catch (e) {}
    });
  }

  function emit(type, payload) {
    // 1. local
    dispatch(type, payload, false);
    // 2. broadcast channel
    if (channel) { try { channel.postMessage({ type: type, payload: payload }); } catch (e) {} }
    // 3. storage fallback (ping)
    try {
      localStorage.setItem('__elo_bus__', JSON.stringify({ type: type, payload: payload, t: Date.now() }));
    } catch (e) {}
  }

  return { on: on, emit: emit };
})();
