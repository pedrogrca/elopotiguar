/* =============================================================================
 * Elo Potiguar — Arquivo de Configuração (CUSTOMIZE AQUI)
 * -----------------------------------------------------------------------------
 * Praticamente toda a personalização da plataforma acontece neste arquivo:
 *  - Nome, marca e cores
 *  - Status de doação e de entrega (e suas cores/ícones)
 *  - Regras do sistema de Pontos de Confiança
 *  - Categorias, habilidades e interesses
 *  - Pesos do algoritmo de matching
 *  - Localização padrão do mapa
 *
 * Altere os valores abaixo e recarregue a página. Para zerar os dados e
 * recarregar os dados de exemplo, use o menu "Admin > Resetar dados".
 * ========================================================================== */
window.EP = window.EP || {};

EP.config = {
  /* ---- Marca ----------------------------------------------------------- */
  app: {
    name: 'Elo Potiguar',
    tagline: 'Conectando quem quer ajudar a quem precisa — com total transparência.',
    short: 'Elo',
    emoji: '🤝',
    region: 'Rio Grande do Norte',
    contactEmail: 'contato@elopotiguar.org',
  },

  /* ---- Tema (cores) — também refletidas no CSS via variáveis ------------ */
  theme: {
    primary: '#0e7c66',     // verde-azulado (confiança)
    primaryDark: '#0a5c4b',
    accent: '#f4a531',      // âmbar (sol potiguar)
    danger: '#d64545',
    info: '#2f6fed',
    bg: '#f6f8f7',
    surface: '#ffffff',
    text: '#1d2b27',
    muted: '#6b7d77',
  },

  /* ---- Papéis de usuário ----------------------------------------------- */
  roles: {
    donor:     { key: 'donor',     label: 'Doador',     emoji: '💝' },
    volunteer: { key: 'volunteer', label: 'Voluntário', emoji: '🙋' },
    deliverer: { key: 'deliverer', label: 'Entregador', emoji: '🛵' },
    org:       { key: 'org',       label: 'Organização', emoji: '🏛️' },
  },

  /* ---- Ciclo de vida da DOAÇÃO (ordem importa!) ------------------------ */
  /* Adicione/remova status livremente; a linha do tempo se adapta sozinha. */
  donationStatuses: [
    { key: 'Pendente',   label: 'Pendente',    color: '#9aa6a2', icon: '🕓', desc: 'Doação registrada, aguardando processamento.' },
    { key: 'Em rota',    label: 'Em rota',     color: '#2f6fed', icon: '🛵', desc: 'Um entregador está mediando a entrega.' },
    { key: 'Recebido',   label: 'Recebido',    color: '#0e7c66', icon: '📦', desc: 'A organização confirmou o recebimento.' },
    { key: 'Em estoque', label: 'Em estoque',  color: '#f4a531', icon: '🏷️', desc: 'O recurso está catalogado no estoque da organização.' },
    { key: 'Usado',      label: 'Usado',       color: '#7b3ff2', icon: '✅', desc: 'O recurso foi destinado à causa proposta.' },
  ],

  /* ---- Ciclo de vida da ENTREGA (estilo iFood) ------------------------- */
  deliveryStatuses: [
    { key: 'Aguardando',  label: 'Aguardando entregador', color: '#9aa6a2', icon: '🔎' },
    { key: 'Aceita',      label: 'Entregador a caminho da coleta', color: '#2f6fed', icon: '🛵' },
    { key: 'Coletado',    label: 'Coletado — a caminho da entrega', color: '#f4a531', icon: '📦' },
    { key: 'Entregue',    label: 'Entregue', color: '#0e7c66', icon: '✅' },
  ],

  /* ---- Sistema de Pontos de Confiança ---------------------------------- */
  /* Quanto cada ação concede de pontos para a organização.                 */
  points: {
    receiveDonation: 5,    // ao confirmar "Recebido"
    stockDonation:   5,    // ao mover para "Em estoque"
    useDonation:     15,   // ao confirmar "Usado" (fechamento do ciclo)
    impactPost:      25,   // ao publicar uma postagem de impacto
    verifiedBonus:   30,   // bônus único por verificação da organização
  },

  /* Faixas de credibilidade conforme pontuação acumulada. */
  trustTiers: [
    { min: 0,   label: 'Nova',        color: '#9aa6a2', icon: '🌱' },
    { min: 60,  label: 'Confiável',   color: '#2f6fed', icon: '🔵' },
    { min: 150, label: 'Reconhecida', color: '#0e7c66', icon: '🟢' },
    { min: 320, label: 'Referência',  color: '#f4a531', icon: '⭐' },
  ],

  /* ---- Tipos de necessidade -------------------------------------------- */
  needTypes: [
    { key: 'material',  label: 'Material',   emoji: '📦', desc: 'Itens físicos (alimentos, roupas, etc.)' },
    { key: 'financial', label: 'Financeiro', emoji: '💰', desc: 'Recursos financeiros' },
    { key: 'volunteer', label: 'Voluntário', emoji: '🙋', desc: 'Ajuda de pessoas com habilidades específicas' },
  ],

  /* ---- Categorias, habilidades e interesses (usados no matching) ------- */
  categories: [
    'Alimentação', 'Saúde', 'Educação', 'Moradia', 'Vestuário',
    'Animais', 'Idosos', 'Crianças', 'Meio ambiente', 'Inclusão',
  ],

  skills: [
    'Cozinha', 'Medicina', 'Enfermagem', 'Psicologia', 'Direito',
    'Contabilidade', 'Marketing', 'Programação', 'Design', 'Ensino',
    'Carpintaria', 'Elétrica', 'Transporte', 'Tradução', 'Fotografia',
  ],

  interests: [
    'Alimentação', 'Saúde', 'Educação', 'Moradia', 'Vestuário',
    'Animais', 'Idosos', 'Crianças', 'Meio ambiente', 'Inclusão',
  ],

  /* ---- Pesos do algoritmo de matching ---------------------------------- */
  /* Score = wSkill*habilidades + wInterest*interesses + wUrgency*urgência   */
  /*         + wVulnerability*vulnerabilidade + wLocation*mesma cidade       */
  matching: {
    wSkill: 5,
    wInterest: 3,
    wUrgency: 2,
    wVulnerability: 2,
    wLocation: 4,
  },

  /* ---- Mapa ------------------------------------------------------------- */
  map: {
    center: { lat: -5.7945, lng: -35.2110 }, // Natal/RN
    zoom: 12,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: '© OpenStreetMap',
    gpsUpdateMs: 1200,   // intervalo de atualização do GPS simulado
  },

  /* ---- Backend ---------------------------------------------------------- */
  /* mode 'local'    => dados no navegador (localStorage), sem servidor.      */
  /* mode 'supabase' => backend real: Postgres + Realtime (multi-dispositivo).*/
  /* Para voltar ao modo offline, troque mode para 'local'.                  */
  backend: {
    mode: 'supabase',
    url: 'https://cszhalwpzrpbqwxmhgqt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzemhhbHdwenJwYnF3eG1oZ3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1OTM0ODgsImV4cCI6MjA5ODE2OTQ4OH0.-1IjvVm24umM9Hdz8ePWb2pEIclLz5nCW-nrPsuJKWg',
  },

  /* ---- LGPD / Jurídico (customize) ------------------------------------- */
  legal: {
    controller: 'Elo Potiguar',                 // controlador dos dados
    dpoEmail: 'privacidade@elopotiguar.org',     // encarregado (DPO)
    privacyVersion: '1.0',
    termsVersion: '1.0',
    updatedAt: '2026-06-28',
    // Dados coletados e finalidade (transparência — art. 9º LGPD)
    dataCollected: [
      { item: 'Nome', why: 'Identificar você na plataforma' },
      { item: 'E-mail', why: 'Login, segurança e comunicações essenciais' },
      { item: 'Senha (cifrada)', why: 'Autenticar seu acesso — guardada apenas como hash PBKDF2' },
      { item: 'Cidade', why: 'Aproximar você de causas e entregas próximas' },
      { item: 'Habilidades e interesses', why: 'Conectar voluntários às necessidades certas (opcional)' },
      { item: 'Localização durante a entrega', why: 'Rastreamento em tempo real, apenas enquanto a entrega ocorre' },
    ],
    legalBasis: 'Consentimento e execução de serviço (art. 7º, I e V, LGPD).',
    retention: 'Mantemos seus dados enquanto a conta existir. Você pode exportar ou excluir a qualquer momento.',
  },

  /* ---- Assistente / Chatbot (Eloá) ------------------------------------- */
  assistant: {
    enabled: true,
    name: 'Eloá',
    emoji: '💬',
    greeting: 'Oi! Eu sou a Eloá 🤝 Posso te conectar a uma organização que combina com você, explicar como funciona a doação e o rastreio, e tirar dúvidas. Como posso ajudar?',
    suggestions: ['Quero doar', 'Conecte-me a uma causa', 'Por que devo doar?', 'Como funciona a entrega?'],
    // Modo IA (opcional). Sem chave, a Eloá responde no modo local (fundamentado nos dados do app).
    provider: 'anthropic',          // 'anthropic' (Claude) ou 'openai' (GPT)
    model: 'claude-opus-4-8',       // modelo Claude (troque se quiser; ex.: 'claude-haiku-4-5' p/ menor custo)
    openaiModel: 'gpt-4o-mini',     // modelo OpenAI, se provider = 'openai'
    apiKey: '',                     // NÃO embuta uma chave aqui em produção. Cada usuário cola a sua em ⚙️ (guardada só no navegador dele). Em produção, use um proxy (Supabase Edge Function).
    maxTokens: 1024,
  },

  /* ---- Geral ------------------------------------------------------------ */
  currency: (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  storageKey: 'elo_potiguar_db_v1',
  sessionKey: 'elo_potiguar_session_v1',
  demoPassword: '123456', // senha de todas as contas de exemplo
};

/* Aplica as cores do tema às variáveis CSS automaticamente. */
(function applyTheme() {
  try {
    var t = EP.config.theme, r = document.documentElement.style;
    r.setProperty('--c-primary', t.primary);
    r.setProperty('--c-primary-dark', t.primaryDark);
    r.setProperty('--c-accent', t.accent);
    r.setProperty('--c-danger', t.danger);
    r.setProperty('--c-info', t.info);
    r.setProperty('--c-bg', t.bg);
    r.setProperty('--c-surface', t.surface);
    r.setProperty('--c-text', t.text);
    r.setProperty('--c-muted', t.muted);
  } catch (e) { /* DOM ainda não pronto; CSS tem fallback */ }
})();
