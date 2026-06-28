/* =============================================================================
 * chatbot.js — Assistente "Eloá"
 * -----------------------------------------------------------------------------
 * Conversa com doadores/voluntários para conectá-los a organizações, dar motivos
 * para doar e tirar dúvidas. Funciona em dois modos:
 *   • LOCAL (padrão, sem chave): respostas fundamentadas nos dados reais do app
 *     (organizações, necessidades, status, pontos, LGPD). Sempre funciona.
 *   • IA (opcional): se houver chave de API, usa um LLM (Claude/Anthropic por
 *     padrão, ou OpenAI) com os dados do app como contexto. A chave é colada por
 *     cada usuário e guardada apenas no navegador dele (não embuta chave no site;
 *     em produção, faça proxy por uma Supabase Edge Function).
 * ========================================================================== */
window.EP = window.EP || {};

EP.chatbot = (function () {
  var el = EP.ui.el;
  var KEY_STORE = 'elo_assistant_key_v1';
  var history = [];          // [{role:'user'|'assistant', text}]
  var panel, msgsEl, inputEl, mounted = false, busy = false;

  function cfg() { return EP.config.assistant || {}; }
  function getKey() { try { return cfg().apiKey || localStorage.getItem(KEY_STORE) || ''; } catch (e) { return cfg().apiKey || ''; } }
  function setKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) {} }
  function aiAvailable() { return !!getKey(); }

  /* ===================== CONTEXTO FUNDAMENTADO ========================== */
  function knowledge() {
    var C = EP.config, L = EP.logic, lines = [];
    lines.push('PLATAFORMA: ' + C.app.name + ' — ' + C.app.tagline + ' (região: ' + C.app.region + ').');
    lines.push('Papéis: Doador, Voluntário, Entregador, Organização. Uma pessoa pode acumular papéis pessoais; "Organização" é conta à parte.');
    lines.push('Rastreio da doação (transparência): ' + C.donationStatuses.map(function (s) { return s.label; }).join(' → ') + '. Cada etapa registra data, autor e observação visível ao doador.');
    lines.push('Entrega por voluntário (estilo iFood): 2 códigos automáticos — o entregador digita o CÓDIGO DO CLIENTE para coletar e o CÓDIGO DA ORGANIZAÇÃO para concluir; há GPS ao vivo no mapa.');
    lines.push('Pontos de Confiança: a organização ganha pontos ao confirmar recebimento (+' + C.points.receiveDonation + '), estoque (+' + C.points.stockDonation + '), uso (+' + C.points.useDonation + ') e postagem de impacto (+' + C.points.impactPost + '); isso gera credibilidade e ranking.');
    lines.push('Doação financeira é simulada (sem cobrança real) e a organização detalha a alocação do dinheiro.');
    lines.push('Privacidade/LGPD: senha com PBKDF2 (nunca em texto), consentimento no cadastro, exportar/excluir dados em "Meus dados", GPS só durante a entrega.');
    var u = EP.auth.currentUser();
    lines.push('Usuário atual: ' + (u ? (u.name + ' (papéis: ' + (u.roles || []).join(', ') + ')') : 'visitante não logado') + '.');
    lines.push('');
    lines.push('ORGANIZAÇÕES (priorize as de maior vulnerabilidade e necessidades urgentes):');
    L.prioritizedOrgs().forEach(function (p) {
      var o = p.org, tier = L.trustTier(o.trustPoints || 0);
      var needs = p.needs.map(function (n) { return n.title + ' [' + n.type + ', urgência ' + n.urgency + ']'; });
      lines.push('- ' + o.name + ' (id:' + o.id + ') · ' + o.category + ' · ' + o.city + ' · vulnerabilidade ' + o.vulnerability + '/5 · ' + (o.trustPoints || 0) + ' pts (' + tier.label + ')' + (o.verified ? ' · verificada' : '') +
        '. ' + (o.description || '') + (needs.length ? ' Necessidades: ' + needs.join('; ') + '.' : ' Sem necessidades abertas.'));
    });
    return lines.join('\n');
  }

  function systemPrompt() {
    return [
      'Você é a ' + cfg().name + ', a assistente do ' + EP.config.app.name + ', uma plataforma de beneficência que conecta doadores e voluntários a organizações com transparência.',
      'Objetivos: (1) conectar a pessoa à organização certa conforme interesses/causa/cidade, priorizando as mais vulneráveis; (2) dar motivos concretos e honestos para doar ou se voluntariar; (3) tirar dúvidas sobre doação, rastreio, entrega, pontos e privacidade.',
      'Regras: responda SEMPRE em português do Brasil, de forma calorosa, breve e objetiva (2 a 5 frases). Use SOMENTE as organizações e dados fornecidos no contexto — nunca invente nomes, números ou necessidades. Ao recomendar, cite o nome exato da organização e por que ela combina (causa, vulnerabilidade, necessidade). Sugira o próximo passo (ex.: "posso te levar à página dela para doar"). Não prometa cobranças reais (pagamento é simulado). Não invente políticas.',
      '',
      'CONTEXTO ATUAL DA PLATAFORMA:',
      knowledge(),
    ].join('\n');
  }

  /* ===================== CLIENTE LLM (opcional) ======================== */
  async function callAnthropic(system, messages) {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': getKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: cfg().model || 'claude-opus-4-8', max_tokens: cfg().maxTokens || 1024, system: system, messages: messages }),
    });
    if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (await res.text()).slice(0, 180));
    var data = await res.json();
    if (data.stop_reason === 'refusal') return 'Desculpe, não consigo responder isso.';
    var text = (data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
    return text || 'Não consegui formular uma resposta.';
  }
  async function callOpenAI(system, messages) {
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + getKey() },
      body: JSON.stringify({ model: cfg().openaiModel || 'gpt-4o-mini', max_tokens: cfg().maxTokens || 1024, messages: [{ role: 'system', content: system }].concat(messages) }),
    });
    if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 180));
    var data = await res.json();
    return ((data.choices && data.choices[0] && data.choices[0].message.content) || '').trim() || 'Sem resposta.';
  }
  async function llmReply() {
    var messages = history.map(function (m) { return { role: m.role, content: m.text }; });
    var system = systemPrompt();
    return cfg().provider === 'openai' ? callOpenAI(system, messages) : callAnthropic(system, messages);
  }

  /* ===================== MOTOR LOCAL (sempre funciona) ================= */
  function norm(s) { return stripAccents((s || '').toLowerCase()); }
  function stripAccents(s) { return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, ''); }
  function has(t, arr) { return arr.some(function (w) { return t.indexOf(w) >= 0; }); }

  function detectCategory(t) {
    var found = null;
    EP.config.categories.forEach(function (c) { if (norm(t).indexOf(norm(c)) >= 0) found = c; });
    var syn = { 'comida': 'Alimentação', 'fome': 'Alimentação', 'alimento': 'Alimentação', 'cesta': 'Alimentação',
      'animal': 'Animais', 'cachorro': 'Animais', 'gato': 'Animais', 'pet': 'Animais',
      'crianca': 'Crianças', 'escola': 'Educação', 'estudo': 'Educação', 'ensino': 'Educação',
      'idoso': 'Idosos', 'velho': 'Idosos', 'saude': 'Saúde', 'doente': 'Saúde', 'casa': 'Moradia', 'roupa': 'Vestuário' };
    if (!found) Object.keys(syn).forEach(function (k) { if (norm(t).indexOf(k) >= 0) found = syn[k]; });
    return found;
  }

  function orgChips(orgs) {
    var actions = orgs.slice(0, 3).map(function (o) { return { label: '🏛️ ' + o.name, hash: '#/org/' + o.id }; });
    actions.push({ label: 'Ver todas as organizações', hash: '#/organizacoes' });
    return actions;
  }

  function recommend(cat) {
    var u = EP.auth.currentUser();
    var ranked = (u ? EP.logic.recommendOrgs(u) : EP.logic.prioritizedOrgs());
    var list = ranked.map(function (p) { return p.org; });
    if (cat) list = list.filter(function (o) { return o.category === cat; }).concat(list.filter(function (o) { return o.category !== cat; }));
    var top = list.slice(0, 3);
    var intro = cat ? ('Pensando em **' + cat + '**, estas são ótimas opções:') : 'Estas organizações precisam muito de apoio agora (priorizei as mais vulneráveis):';
    var body = top.map(function (o) {
      var need = EP.db.needsOfOrg(o.id).filter(function (n) { return n.status === 'open'; })[0];
      return '• **' + o.name + '** (' + o.category + ', ' + o.city + ') — vulnerabilidade ' + o.vulnerability + '/5' + (need ? '. Precisa de: ' + need.title + '.' : '.');
    }).join('\n');
    return { text: intro + '\n' + body + '\n\nQuer abrir alguma delas para doar?', actions: orgChips(top) };
  }

  function reasonsToDonate() {
    var s = EP.logic.globalStats();
    var pri = EP.logic.prioritizedOrgs()[0];
    return {
      text: 'Doar aqui faz diferença real — e você vê isso acontecer:\n' +
        '• **Transparência total**: você acompanha sua doação de "Recebido" a "Usado", com data e mensagem da organização.\n' +
        '• **Vai para quem mais precisa**: priorizamos as organizações mais vulneráveis' + (pri ? ' (ex.: ' + pri.org.name + ', vulnerabilidade ' + pri.org.vulnerability + '/5)' : '') + '.\n' +
        '• **Confiança comprovada**: organizações ganham Pontos de Confiança ao comprovar o uso do recurso.\n' +
        '• **Impacto coletivo**: já são ' + s.donations + ' doações e ' + s.completed + ' ciclos concluídos.\n\nPosso te recomendar uma causa?',
      actions: [{ label: '💝 Quero doar', hash: '#/organizacoes' }, { label: 'Conecte-me a uma causa', send: 'Conecte-me a uma causa' }],
    };
  }

  function ruleBased(text) {
    var t = norm(text);
    if (has(t, ['oi', 'ola', 'opa', 'bom dia', 'boa tarde', 'boa noite', 'eai', 'e ai'])) {
      return { text: 'Oi! 😊 Posso te conectar a uma organização, explicar como doar e acompanhar, ou tirar dúvidas. O que você procura?', actions: suggestionsAsActions() };
    }
    if (has(t, ['por que', 'porque', 'pq ', 'vale a pena', 'motivo', 'convenc'])) return reasonsToDonate();
    if (has(t, ['recomend', 'conecte', 'conecta', 'indica', 'indique', 'qual organiz', 'qual ong', 'sugest', 'ajudar com', 'me ajuda a escolher', 'causa'])) return recommend(detectCategory(text));
    if (has(t, ['voluntari', 'ser voluntario', 'doar meu tempo', 'habilidade', 'ajudar como'])) {
      var u = EP.auth.currentUser();
      if (u && (u.roles || []).indexOf('volunteer') >= 0) return { text: 'Que ótimo! No seu painel há oportunidades de voluntariado ordenadas pela compatibilidade com suas habilidades e cidade. Quer ver?', actions: [{ label: '🙋 Ver oportunidades', hash: '#/painel?tab=volunteer' }] };
      return { text: 'Adorei! Voluntários conectam suas **habilidades e interesses** às necessidades das organizações. Crie uma conta como Voluntário e a gente já te mostra vagas compatíveis com você.', actions: [{ label: 'Criar conta de voluntário', hash: '#/cadastro' }, { label: 'Ver necessidades', hash: '#/organizacoes' }] };
    }
    if (has(t, ['entrega', 'entregador', 'codigo', 'ifood', 'gps', 'rastre', 'coleta'])) {
      return { text: 'Na entrega por voluntário você acompanha tudo ao vivo no mapa (GPS). São **dois códigos automáticos**: o entregador digita o *código do cliente* ao coletar a doação e o *código da organização* ao entregar — só assim a entrega é concluída. Segurança estilo iFood. 🛵', actions: [{ label: 'Quero ser entregador', hash: '#/cadastro' }] };
    }
    if (has(t, ['status', 'acompanh', 'recebido', 'estoque', 'usado', 'transparenc', 'onde esta', 'rastreio'])) {
      return { text: 'Total transparência: sua doação passa por **Recebido → Em estoque → Usado** (e "Em rota" se houver entrega). Em cada etapa a organização registra data e uma mensagem (ex.: "distribuídas para 20 famílias"). Em doações financeiras, ela detalha onde o dinheiro foi aplicado.', actions: [{ label: 'Ver organizações', hash: '#/organizacoes' }] };
    }
    if (has(t, ['ponto', 'confianca', 'ranking', 'credibilidade'])) {
      return { text: 'Os **Pontos de Confiança** incentivam as organizações a comprovar o impacto: elas ganham pontos ao confirmar recebimento, registrar o uso e publicar postagens de impacto. Mais pontos = mais credibilidade no ranking — e mais doações. 🏆', actions: [{ label: 'Ver ranking', hash: '#/' }] };
    }
    if (has(t, ['segur', 'privac', 'lgpd', 'dados', 'senha', 'confiavel', 'golpe'])) {
      return { text: 'Levamos privacidade a sério: senhas protegidas com PBKDF2 (nunca guardadas em texto), consentimento no cadastro, e você pode **exportar ou excluir** seus dados em "Meus dados". O GPS do entregador só é compartilhado durante a entrega. 🔒', actions: [{ label: 'Política de Privacidade', hash: '#/privacidade' }, { label: 'Meus dados (LGPD)', hash: '#/meus-dados' }] };
    }
    if (has(t, ['doar', 'doacao', 'doaçao', 'contribuir', 'ajudar', 'quero ajudar'])) {
      var cat = detectCategory(text);
      if (cat) return recommend(cat);
      return { text: 'Que generoso! 💚 Você pode doar **itens** ou **valor**, e acompanhar tudo até o "Usado". Me diz uma causa que te toca (ex.: alimentação, crianças, animais, idosos) que eu te indico uma organização — ou veja todas:', actions: [{ label: 'Ver organizações', hash: '#/organizacoes' }, { label: 'Causa: Alimentação', send: 'Quero ajudar com alimentação' }, { label: 'Causa: Crianças', send: 'Quero ajudar com crianças' }] };
    }
    if (has(t, ['obrigad', 'valeu', 'brigad', 'tchau'])) return { text: 'Por nada! 💚 Qualquer dúvida, é só chamar. Sua ajuda transforma vidas aqui no ' + EP.config.app.region + '.', actions: suggestionsAsActions() };
    // fallback
    return { text: 'Posso te ajudar a **encontrar uma causa**, explicar **como doar e acompanhar**, falar das **entregas** ou da **segurança/LGPD**. Por onde começamos?', actions: suggestionsAsActions() };
  }

  function suggestionsAsActions() {
    return (cfg().suggestions || []).map(function (s) { return { label: s, send: s }; });
  }

  /* ===================== ORQUESTRAÇÃO ================================== */
  async function ask(text) {
    if (busy) return;
    text = (text || '').trim(); if (!text) return;
    pushMsg('user', text);
    history.push({ role: 'user', text: text });

    if (aiAvailable()) {
      busy = true; var typing = pushTyping();
      try {
        var reply = await llmReply();
        typing.remove();
        pushMsg('assistant', reply, llmActions(reply));
        history.push({ role: 'assistant', text: reply });
      } catch (e) {
        typing.remove();
        var fb = ruleBased(text);
        pushMsg('assistant', '⚠️ (IA indisponível: ' + (e.message || e) + ') — respondendo no modo local:\n\n' + fb.text, fb.actions);
        history.push({ role: 'assistant', text: fb.text });
      } finally { busy = false; }
    } else {
      var r = ruleBased(text);
      pushMsg('assistant', r.text, r.actions);
      history.push({ role: 'assistant', text: r.text });
    }
  }

  // No modo IA, gera atalhos clicáveis para organizações citadas no texto.
  function llmActions(text) {
    var acts = [];
    EP.db.all('organizations').forEach(function (o) {
      if (text.indexOf(o.name) >= 0 && acts.length < 3) acts.push({ label: '🏛️ ' + o.name, hash: '#/org/' + o.id });
    });
    if (acts.length) acts.push({ label: 'Ver todas', hash: '#/organizacoes' });
    return acts;
  }

  /* ===================== UI ============================================ */
  function fmt(text) {
    return EP.ui.esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function pushMsg(role, text, actions) {
    var bubble = el('div.cbot-msg', { class: 'cbot-msg--' + role }, [el('div.cbot-bubble', { html: fmt(text) })]);
    if (actions && actions.length) {
      bubble.appendChild(el('div.cbot-actions', {}, actions.map(function (a) {
        return el('button.cbot-chip', { text: a.label, onClick: function () {
          if (a.send) { ask(a.send); }
          else if (a.hash) { EP.app.go(a.hash); /* mantém o chat aberto */ }
        } });
      })));
    }
    msgsEl.appendChild(bubble);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return bubble;
  }
  function pushTyping() {
    var t = el('div.cbot-msg.cbot-msg--assistant', {}, [el('div.cbot-bubble.cbot-typing', { html: '<span></span><span></span><span></span>' })]);
    msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
    return t;
  }

  function openSettings() {
    var provSel = el('select.input', {}, [el('option', { value: 'anthropic', text: 'Claude (Anthropic)' }), el('option', { value: 'openai', text: 'GPT (OpenAI)' })]);
    provSel.value = cfg().provider || 'anthropic';
    var keyIn = el('input.input', { type: 'password', placeholder: 'Cole sua chave de API (sk-... / sk-ant-...)', value: getKey() });
    EP.ui.modal({
      title: '⚙️ Assistente — modo IA',
      body: el('div.form', {}, [
        el('p.muted', { text: 'Sem chave, a Eloá já funciona no modo local (com os dados do app). Para respostas por IA, escolha o provedor e cole sua própria chave — ela fica guardada só no seu navegador.' }),
        el('label.field', {}, [el('span.field__label', { text: 'Provedor' }), provSel]),
        el('label.field', {}, [el('span.field__label', { text: 'Chave de API' }), keyIn]),
        el('p.muted.tiny', { text: '⚠️ Em produção, não exponha a chave no navegador — use um proxy (ex.: Supabase Edge Function). Isto é para demonstração.' }),
      ]),
      actions: [
        { label: 'Usar modo local', kind: 'ghost', onClick: function () { setKey(''); EP.ui.toast('Modo local ativado.', 'info'); } },
        { label: 'Salvar', kind: 'primary', onClick: function () { EP.config.assistant.provider = provSel.value; setKey(keyIn.value.trim()); EP.ui.toast(keyIn.value.trim() ? 'Modo IA ativado! 🤖' : 'Modo local ativado.', 'success'); } },
      ],
    });
  }

  function buildPanel() {
    msgsEl = el('div.cbot-msgs');
    inputEl = el('input.cbot-input', { placeholder: 'Escreva sua mensagem...', onKeydown: function (e) { if (e.key === 'Enter') { ask(inputEl.value); inputEl.value = ''; } } });
    panel = el('div.cbot-panel', { class: 'cbot-panel--hidden' }, [
      el('div.cbot-head', {}, [
        el('div.cbot-head__id', {}, [el('span.cbot-avatar', { text: cfg().emoji || '💬' }), el('div', {}, [el('strong', { text: cfg().name }), el('div.cbot-head__sub', { text: aiAvailable() ? 'modo IA' : 'assistente' })])]),
        el('div.cbot-head__tools', {}, [
          el('button.cbot-iconbtn', { title: 'Modo IA', html: '⚙️', onClick: openSettings }),
          el('button.cbot-iconbtn', { title: 'Fechar', html: '&times;', onClick: toggle }),
        ]),
      ]),
      msgsEl,
      el('div.cbot-inputbar', {}, [inputEl, el('button.cbot-send', { html: '➤', onClick: function () { ask(inputEl.value); inputEl.value = ''; } })]),
    ]);
    // saudação + sugestões
    pushMsg('assistant', cfg().greeting, suggestionsAsActions());
    return panel;
  }

  var fab;
  function toggle() {
    var hidden = panel.classList.contains('cbot-panel--hidden');
    panel.classList.toggle('cbot-panel--hidden');
    fab.classList.toggle('cbot-fab--open', hidden);
    if (hidden) setTimeout(function () { inputEl && inputEl.focus(); }, 50);
  }

  function mount() {
    if (mounted || !cfg().enabled) return;
    mounted = true;
    fab = el('button.cbot-fab', { title: 'Falar com a ' + cfg().name, onClick: toggle }, [el('span', { text: cfg().emoji || '💬' })]);
    var wrap = el('div.cbot-root', {}, [buildPanel(), fab]);
    document.body.appendChild(wrap);
  }

  return { mount: mount, ask: ask, open: function () { if (panel && panel.classList.contains('cbot-panel--hidden')) toggle(); } };
})();
