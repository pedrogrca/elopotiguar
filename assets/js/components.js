/* =============================================================================
 * components.js — Peças de UI reutilizáveis + Mapa de GPS
 * ========================================================================== */
window.EP = window.EP || {};

EP.components = (function () {
  var el = EP.ui.el, esc = EP.ui.esc;

  /* ---- Marca gerada (logo/capa de exemplo via SVG data-url) ------------ */
  function svgUrl(svg) { return 'data:image/svg+xml,' + encodeURIComponent(svg); }
  function hueOf(seed) { var h = 0; seed = String(seed || ''); for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360; return h; }
  function brandLogo(seed, text) {
    var h = hueOf(seed), h2 = (h + 40) % 360, t = esc((text || '?').slice(0, 2).toUpperCase());
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + h + ',60%,46%)"/><stop offset="1" stop-color="hsl(' + h2 + ',62%,36%)"/></linearGradient></defs><rect width="160" height="160" rx="36" fill="url(#g)"/><text x="80" y="100" font-family="Arial,Helvetica,sans-serif" font-size="62" font-weight="700" fill="#fff" text-anchor="middle">' + t + '</text></svg>');
  }
  function brandCover(seed) {
    var h = hueOf(seed), h2 = (h + 50) % 360;
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + h + ',55%,42%)"/><stop offset="1" stop-color="hsl(' + h2 + ',58%,28%)"/></linearGradient></defs><rect width="1200" height="360" fill="url(#g)"/><circle cx="980" cy="80" r="220" fill="rgba(255,255,255,0.07)"/><circle cx="1090" cy="300" r="150" fill="rgba(255,255,255,0.06)"/><circle cx="160" cy="330" r="200" fill="rgba(0,0,0,0.06)"/></svg>');
  }
  // <img> do logo (ou avatar com iniciais se não houver)
  function orgLogo(org, size) {
    size = size || 46;
    var src = org.logo || brandLogo(org.name, org.name);
    return el('img.brand-logo', { src: src, alt: org.name, style: { width: size + 'px', height: size + 'px' } });
  }
  function sealTier(score) {
    var t = EP.config.companySeal[0];
    EP.config.companySeal.forEach(function (s) { if (score >= s.min) t = s; });
    return t;
  }

  /* ---- Selo de confiança ----------------------------------------------- */
  function trustBadge(org) {
    var tier = EP.logic.trustTier(org.trustPoints || 0);
    return el('span.trust-badge', { style: { background: tier.color + '18', color: tier.color, borderColor: tier.color + '55' } }, [
      el('span', { text: tier.icon + ' ' }),
      el('strong', { text: tier.label }),
      el('span.trust-badge__pts', { text: ' · ' + (org.trustPoints || 0) + ' pts' }),
    ]);
  }

  function vulnerabilityBar(level) {
    var wrap = el('span.vuln', { title: 'Vulnerabilidade ' + level + '/5' });
    for (var i = 1; i <= 5; i++) wrap.appendChild(el('span.vuln__dot', { class: i <= level ? 'vuln__dot--on' : '' }));
    return wrap;
  }

  function statusPill(status) {
    var m = EP.logic.statusMeta(status);
    return el('span.pill', { style: { background: m.color + '18', color: m.color, borderColor: m.color + '55' }, text: m.icon + ' ' + m.label });
  }

  /* ---- Cartão de organização ------------------------------------------- */
  function orgCard(org, opts) {
    opts = opts || {};
    var needs = EP.db.needsOfOrg(org.id).filter(function (n) { return n.status === 'open'; });
    var card = el('div.card.org-card', { onClick: function () { EP.app.go('#/org/' + org.id); } }, [
      el('div.org-card__top', {}, [
        orgLogo(org, 46),
        el('div.org-card__id', {}, [
          el('div.org-card__name', {}, [
            el('span', { text: org.name }),
            org.verified ? el('span.verified', { title: 'Organização verificada', text: ' ✔' }) : null,
          ]),
          el('div.org-card__meta', { text: (org.category || '') + ' · ' + (org.city || '') }),
        ]),
      ]),
      el('p.org-card__desc', { text: org.description || '' }),
      el('div.org-card__foot', {}, [
        trustBadge(org),
        el('span.org-card__needs', { text: needs.length + ' necessidade' + (needs.length === 1 ? '' : 's') }),
      ]),
      el('div.org-card__vuln', {}, [el('span.muted', { text: 'Vulnerabilidade ' }), vulnerabilityBar(org.vulnerability || 0)]),
    ]);
    return card;
  }

  /* ---- Cartão de necessidade ------------------------------------------- */
  function needCard(need, org, opts) {
    opts = opts || {};
    var type = EP.config.needTypes.find(function (t) { return t.key === need.type; }) || {};
    var urg = el('span.urg', {}, []);
    for (var i = 1; i <= 5; i++) urg.appendChild(el('span.urg__dot', { class: i <= (need.urgency || 0) ? 'urg__dot--on' : '' }));

    var actions = [];
    if (opts.showDonate && need.type !== 'volunteer') {
      actions.push(el('button.btn.btn--sm.btn--primary', { text: 'Doar', onClick: function (e) { e.stopPropagation(); EP.app.go('#/doar/' + org.id + '?need=' + need.id); } }));
    }
    if (opts.showVolunteer && need.type === 'volunteer') {
      actions.push(el('button.btn.btn--sm.btn--accent', { text: 'Quero ajudar', onClick: function (e) { e.stopPropagation(); EP.views.applyVolunteer(need, org); } }));
    }
    if (opts.onEdit) actions.push(el('button.btn.btn--sm.btn--ghost', { text: 'Editar', onClick: function (e) { e.stopPropagation(); opts.onEdit(need); } }));
    if (opts.onClose) actions.push(el('button.btn.btn--sm.btn--ghost', { text: need.status === 'open' ? 'Encerrar' : 'Reabrir', onClick: function (e) { e.stopPropagation(); opts.onClose(need); } }));

    return el('div.card.need-card', { class: need.status !== 'open' ? 'need-card--closed' : '' }, [
      el('div.need-card__head', {}, [
        el('span.need-type', { text: (type.emoji || '') + ' ' + (type.label || need.type) }),
        el('span.need-card__urg', {}, [el('span.muted.tiny', { text: 'urgência ' }), urg]),
      ]),
      el('h4.need-card__title', { text: need.title }),
      el('p.need-card__desc', { text: need.description || '' }),
      (need.skills && need.skills.length) ? el('div.need-card__skills', {}, need.skills.map(function (s) { return EP.ui.chip(s); })) : null,
      opts.showOrg && org ? el('div.need-card__org.muted', { text: '🏛️ ' + org.name }) : null,
      actions.length ? el('div.need-card__actions', {}, actions) : null,
    ]);
  }

  /* ---- Linha do tempo de status (transparência) ------------------------ */
  function statusTimeline(donation) {
    // mostra todos os status configurados, marcando os já alcançados
    var reached = {};
    (donation.statusHistory || []).forEach(function (h) { reached[h.status] = h; });
    var flow = EP.config.donationStatuses.filter(function (s) {
      // só mostra "Em rota" se a doação teve entrega
      if (s.key === 'Em rota') return !!donation.needsDelivery;
      return true;
    });

    var wrap = el('div.timeline');
    flow.forEach(function (s, i) {
      var done = !!reached[s.key];
      var isCurrent = donation.status === s.key;
      var hist = reached[s.key];
      wrap.appendChild(el('div.timeline__row', { class: (done ? 'is-done ' : '') + (isCurrent ? 'is-current' : '') }, [
        el('div.timeline__marker', { style: { background: done ? s.color : '#dfe6e3', color: done ? '#fff' : '#9aa6a2' }, text: s.icon }),
        el('div.timeline__body', {}, [
          el('div.timeline__label', {}, [
            el('strong', { text: s.label }),
            done ? el('span.timeline__time', { text: ' · ' + EP.ui.fmtDate(hist.at) }) : el('span.timeline__time.muted', { text: ' · pendente' }),
          ]),
          el('div.timeline__desc.muted', { text: (hist && hist.note) ? hist.note : s.desc }),
        ]),
      ]));
      if (i < flow.length - 1) wrap.appendChild(el('div.timeline__line', { class: done ? 'is-done' : '' }));
    });
    return wrap;
  }

  /* ---- Linha de doação (lista) ----------------------------------------- */
  function donationRow(d, opts) {
    opts = opts || {};
    var org = EP.db.orgById(d.orgId);
    var donor = EP.db.get('users', d.donorId);
    var title = d.type === 'financial' ? EP.config.currency(d.amount) : (d.description || 'Doação material');
    return el('div.card.don-row', { onClick: function () { EP.app.go('#/doacao/' + d.id); } }, [
      el('div.don-row__icon', { text: d.type === 'financial' ? '💰' : '📦' }),
      el('div.don-row__main', {}, [
        el('div.don-row__title', { text: title }),
        el('div.don-row__sub.muted', { text: (opts.showDonor ? ('de ' + (donor ? donor.name : '—') + ' · ') : ('para ' + (org ? org.name : '—') + ' · ')) + EP.ui.timeAgo(d.createdAt) }),
      ]),
      el('div.don-row__status', {}, [statusPill(d.status), d.delivery ? el('span.don-row__truck', { title: 'Com entrega', text: ' 🛵' }) : null]),
    ]);
  }

  /* ---- Cartão de postagem de impacto ----------------------------------- */
  function videoEmbed(url) {
    var yt = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    if (yt) return el('div.post-video', {}, [el('iframe', { src: 'https://www.youtube.com/embed/' + yt[1], allow: 'fullscreen', allowfullscreen: '', frameborder: '0' })]);
    return el('video.post-video', { src: url, controls: '', preload: 'metadata' });
  }
  function postMedia(post) {
    var imgs = post.images || [];
    var blocks = [];
    if (imgs.length) {
      blocks.push(el('div.post-media', { class: 'post-media--' + Math.min(imgs.length, 3) }, imgs.slice(0, 4).map(function (src, i) {
        return el('div.post-media__cell', { onClick: function () { lightbox(src); } }, [el('img', { src: src, alt: 'foto' }),
          (i === 3 && imgs.length > 4) ? el('span.post-media__more', { text: '+' + (imgs.length - 4) }) : null]);
      })));
    }
    if (post.video) blocks.push(videoEmbed(post.video));
    return blocks.length ? el('div', {}, blocks) : null;
  }
  function lightbox(src) {
    var ov = el('div.lightbox', { onClick: function () { ov.remove(); } }, [el('img', { src: src })]);
    document.body.appendChild(ov);
  }

  function postCard(post, opts) {
    opts = opts || {};
    var org = EP.db.orgById(post.orgId);
    var hasMedia = (post.images && post.images.length) || post.video;
    return el('div.card.post-card', {}, [
      el('div.post-card__head', {}, [
        org ? orgLogo(org, 40) : EP.ui.avatar('?', 40),
        el('div.post-card__hid', {}, [
          el('div.post-card__org', {}, [
            el('strong', { text: org ? org.name : '—' }),
            org && org.verified ? el('span.verified', { text: ' ✔' }) : null,
          ]),
          el('div.post-card__time.muted', { text: EP.ui.timeAgo(post.createdAt) }),
        ]),
        hasMedia ? el('span.badge.badge--media', { html: '', style: { background: '#0e7c6618', color: '#0e7c66', borderColor: '#0e7c6655' }, text: (post.video ? '🎬' : '📸') + ' comprovado' }) : null,
      ]),
      el('h3.post-card__title', { text: post.title }),
      el('p.post-card__body', { text: post.body }),
      postMedia(post),
      post.donationId ? el('div.post-card__link.muted', {}, [EP.ui.icon('check', 14), el('span', { text: ' vinculada a uma doação recebida' })]) : null,
      el('div.post-card__foot', {}, [
        el('button.like-btn', { html: '❤ <span>' + post.likes + '</span>', onClick: function () {
          EP.db.update('posts', post.id, { likes: (post.likes || 0) + 1 });
          EP.ui.toast('Obrigado pelo apoio!', 'success'); EP.app.render();
        } }),
        el('span.muted.tiny', { text: '+' + (hasMedia ? EP.config.points.impactPostMedia : EP.config.points.impactPost) + ' pts' }),
      ]),
    ]);
  }

  function statCard(value, label, icon) {
    return el('div.stat', {}, [
      el('div.stat__icon', { text: icon }),
      el('div', {}, [el('div.stat__value', { text: value }), el('div.stat__label.muted', { text: label })]),
    ]);
  }

  /* =========================================================================
   * MAPA DE GPS — Leaflet quando disponível; fallback em <canvas>.
   * ====================================================================== */
  function GpsMap(container, opts) {
    opts = opts || {};
    this.container = container;
    this.engine = (typeof L !== 'undefined') ? 'leaflet' : 'canvas';
    this.route = opts.route || [];
    this.pickup = opts.pickup || null;
    this.dropoff = opts.dropoff || null;
    this.courier = opts.courier || null;
    this._init();
  }

  GpsMap.prototype._init = function () {
    var c = EP.config.map;
    if (this.engine === 'leaflet') {
      this.map = L.map(this.container, { zoomControl: true, attributionControl: true });
      L.tileLayer(c.tileUrl, { attribution: c.tileAttribution, maxZoom: 19 }).addTo(this.map);
      this.layers = L.layerGroup().addTo(this.map);
      this.map.setView([c.center.lat, c.center.lng], c.zoom);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'gps-canvas';
      this.container.appendChild(this.canvas);
      this.container.classList.add('gps-canvas-wrap');
    }
    this.redraw();
  };

  GpsMap.prototype.update = function (data) {
    if (data.route) this.route = data.route;
    if (data.pickup) this.pickup = data.pickup;
    if (data.dropoff) this.dropoff = data.dropoff;
    if (data.courier) this.courier = data.courier;
    this.redraw(data.follow);
  };

  GpsMap.prototype._emojiIcon = function (emoji, cls) {
    return L.divIcon({ html: '<div class="map-pin ' + (cls || '') + '">' + emoji + '</div>', className: 'map-pin-wrap', iconSize: [34, 34], iconAnchor: [17, 17] });
  };

  GpsMap.prototype.redraw = function (follow) {
    if (this.engine === 'leaflet') return this._redrawLeaflet(follow);
    return this._redrawCanvas();
  };

  GpsMap.prototype._redrawLeaflet = function (follow) {
    var L_ = L, self = this;
    this.layers.clearLayers();
    var bounds = [];
    if (this.route && this.route.length) {
      var latlngs = this.route.map(function (p) { return [p.lat, p.lng]; });
      L_.polyline(latlngs, { color: EP.config.theme.primary, weight: 5, opacity: 0.5 }).addTo(this.layers);
      bounds = bounds.concat(latlngs);
    }
    if (this.pickup) { L_.marker([this.pickup.lat, this.pickup.lng], { icon: this._emojiIcon('📦', 'pin--pickup') }).addTo(this.layers).bindPopup('Coleta'); bounds.push([this.pickup.lat, this.pickup.lng]); }
    if (this.dropoff) { L_.marker([this.dropoff.lat, this.dropoff.lng], { icon: this._emojiIcon('🏛️', 'pin--drop') }).addTo(this.layers).bindPopup('Entrega'); bounds.push([this.dropoff.lat, this.dropoff.lng]); }
    if (this.courier) {
      this._courierMarker = L_.marker([this.courier.lat, this.courier.lng], { icon: this._emojiIcon('🛵', 'pin--courier') }).addTo(this.layers).bindPopup('Entregador');
      bounds.push([this.courier.lat, this.courier.lng]);
    }
    if (follow && this.courier) {
      this.map.panTo([this.courier.lat, this.courier.lng], { animate: true });
    } else if (bounds.length) {
      try { this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } catch (e) {}
    }
    setTimeout(function () { try { self.map.invalidateSize(); } catch (e) {} }, 60);
  };

  GpsMap.prototype._project = function (p, W, H, b, pad) {
    var x = b.maxLng === b.minLng ? W / 2 : pad + (p.lng - b.minLng) / (b.maxLng - b.minLng) * (W - 2 * pad);
    var y = b.maxLat === b.minLat ? H / 2 : pad + (b.maxLat - p.lat) / (b.maxLat - b.minLat) * (H - 2 * pad);
    return { x: x, y: y };
  };

  GpsMap.prototype._redrawCanvas = function () {
    var cv = this.canvas, ctx = cv.getContext('2d');
    var rect = this.container.getBoundingClientRect();
    var W = cv.width = Math.max(280, rect.width), H = cv.height = Math.max(260, rect.height || 300);
    var pad = 34;
    var all = (this.route || []).slice();
    if (this.pickup) all.push(this.pickup);
    if (this.dropoff) all.push(this.dropoff);
    if (this.courier) all.push(this.courier);
    if (!all.length) { ctx.clearRect(0, 0, W, H); return; }
    var b = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
    all.forEach(function (p) { b.minLat = Math.min(b.minLat, p.lat); b.maxLat = Math.max(b.maxLat, p.lat); b.minLng = Math.min(b.minLng, p.lng); b.maxLng = Math.max(b.maxLng, p.lng); });
    var self = this;

    // fundo
    ctx.fillStyle = '#e8f0ed'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d4e0db'; ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // rota
    if (this.route && this.route.length) {
      ctx.strokeStyle = EP.config.theme.primary; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6;
      ctx.beginPath();
      this.route.forEach(function (p, i) { var q = self._project(p, W, H, b, pad); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    function dot(p, color, emoji) {
      var q = self._project(p, W, H, b, pad);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(q.x, q.y, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, q.x, q.y);
    }
    if (this.pickup) dot(this.pickup, '#0e7c66', '📦');
    if (this.dropoff) dot(this.dropoff, '#d64545', '🏛️');
    if (this.courier) {
      var q = self._project(this.courier, W, H, b, pad);
      ctx.fillStyle = 'rgba(47,111,237,0.25)'; ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, 7); ctx.fill();
      dot(this.courier, '#2f6fed', '🛵');
    }
    // legenda
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(8, H - 26, 200, 18);
    ctx.fillStyle = '#456'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('📦 coleta   🏛️ entrega   🛵 entregador', 12, H - 13);
  };

  return {
    trustBadge: trustBadge, vulnerabilityBar: vulnerabilityBar, statusPill: statusPill,
    orgCard: orgCard, needCard: needCard, statusTimeline: statusTimeline,
    donationRow: donationRow, postCard: postCard, statCard: statCard, GpsMap: GpsMap,
    brandLogo: brandLogo, brandCover: brandCover, orgLogo: orgLogo, sealTier: sealTier, postMedia: postMedia,
  };
})();
