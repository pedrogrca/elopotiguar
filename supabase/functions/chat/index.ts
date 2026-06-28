// =============================================================================
// Elo Potiguar — Proxy seguro do assistente "Eloá" (Supabase Edge Function)
// -----------------------------------------------------------------------------
// Mantém a CHAVE DE API no servidor (secret do Supabase), nunca no navegador.
// O front (assets/js/chatbot.js) chama POST /functions/v1/chat com:
//   { messages: [{role, content}], context: "<dados ao vivo da plataforma>" }
// e recebe { reply }.
//
// COMO PUBLICAR (sem CLI):
//   1. Supabase → Edge Functions → "Deploy a new function" / "Create function"
//      → nome: chat → cole este arquivo → Deploy.
//   2. Supabase → Project Settings → Edge Functions → Secrets (ou "Manage secrets")
//      → adicione  ANTHROPIC_API_KEY = sk-ant-...   (e, opcional, ANTHROPIC_MODEL).
//      Para usar OpenAI no lugar: defina  OPENAI_API_KEY  (e opcional OPENAI_MODEL).
//   3. No app, em assets/js/config.js, deixe  assistant.proxy = true.
//
// COM CLI (alternativa):
//   supabase functions deploy chat --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PERSONA = `Você é a Eloá, a assistente do Elo Potiguar, uma plataforma de beneficência que conecta doadores e voluntários a organizações, com transparência total. Responda SEMPRE em português do Brasil, de forma calorosa, breve e objetiva (2 a 5 frases). Seus objetivos: (1) conectar a pessoa à organização certa conforme interesses/causa/cidade, priorizando as mais vulneráveis; (2) dar motivos concretos e honestos para doar ou se voluntariar; (3) tirar dúvidas sobre o funcionamento da plataforma (o "modelo"), doação, rastreio, entrega, pontos e privacidade. Use SOMENTE as informações fornecidas (base + dados ao vivo); nunca invente organizações, números ou políticas. Ao recomendar, cite o nome exato da organização e por que combina, e sugira o próximo passo. Pagamentos são simulados (não prometa cobrança real).`;

// Base de conhecimento destilada do README / projeto real.
const KB = `BASE DE CONHECIMENTO — ELO POTIGUAR

O QUE É: plataforma de beneficência (Rio Grande do Norte) que une voluntários e doadores a organizações, casando habilidades/interesses/recursos com as necessidades das organizações, priorizando as em maior vulnerabilidade.

PAPÉIS: Doador, Voluntário, Entregador e Organização. Uma pessoa pode acumular papéis pessoais (doar, se voluntariar, entregar); "Organização" é um tipo de conta à parte.

DOAÇÃO E TRANSPARÊNCIA: ao doar (itens ou valor), o doador acompanha uma linha do tempo de status: Pendente → (Em rota, se houver entrega) → Recebido → Em estoque → Usado. Cada mudança registra data, quem alterou e uma observação visível ao doador (ex.: "distribuídas para 20 famílias"), garantindo que o recurso foi usado para o propósito proposto. Em doações financeiras (simuladas), a organização detalha a alocação do dinheiro (em que foi gasto), com barra de progresso (doado/aplicado/a aplicar).

MATCHING (voluntários): um algoritmo pontua as necessidades de voluntariado conforme habilidades em comum, interesses/causa, urgência, vulnerabilidade da organização e mesma cidade. O voluntário vê oportunidades ordenadas por compatibilidade, se candidata, e a organização aceita/recusa numa caixa de entrada (laço fechado, com notificações).

ENTREGA POR VOLUNTÁRIO (estilo iFood): quem doa itens pode pedir um entregador voluntário. O entregador aceita a entrega e acompanha tudo num mapa com GPS ao vivo. São DOIS códigos de segurança gerados automaticamente: na COLETA o entregador digita o "código do cliente" (do doador) para confirmar que pegou o pedido; na ORGANIZAÇÃO digita o "código de entrega" para concluir. Só com os dois a doação avança para "Recebido". Cada papel vê apenas o código que lhe cabe.

PONTOS DE CONFIANÇA: a organização ganha pontos ao confirmar recebimento, registrar estoque, confirmar o uso e publicar postagens de impacto. Os pontos definem níveis de credibilidade (Nova → Confiável → Reconhecida → Referência) e um ranking público — mais credibilidade atrai mais doações.

NOTIFICAÇÕES: um sininho avisa mudanças de status da doação, entrega aceita/concluída, nova candidatura, candidatura aceita/recusada, alocação financeira e postagens — em tempo real.

SEGURANÇA E LGPD: senhas protegidas com PBKDF2-HMAC-SHA256 (150 mil iterações, salt único) — nunca guardadas em texto; política de senha com medidor de força; mensagens de login genéricas (anti-enumeração). Consentimento obrigatório e versionado no cadastro; página de Privacidade transparente (cada dado e finalidade); o usuário pode exportar (JSON) e excluir a própria conta em "Meus dados" (a exclusão anonimiza o histórico). O GPS do entregador só é compartilhado durante a entrega. Servido por HTTPS.

COMO USAR: navegue por "Organizações" (priorizadas por vulnerabilidade e seus interesses), abra uma e clique em "Doar". Acompanhe em "Meu painel". Para ajudar com seu tempo, cadastre-se como Voluntário; para mediar entregas, como Entregador.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* corpo vazio */ }
  const context: string = typeof body.context === "string" ? body.context.slice(0, 6000) : "";
  const rawMessages: any[] = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.slice(-12).map((m) => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: String((m && m.content) || "").slice(0, 4000),
  })).filter((m) => m.content);
  if (!messages.length) return json({ reply: "Oi! Eu sou a Eloá 🤝 Como posso ajudar?" });

  const system = `${PERSONA}\n\n${KB}` + (context ? `\n\nDADOS AO VIVO DA PLATAFORMA (use estes números e organizações reais):\n${context}` : "");

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    let reply = "";
    if (anthropicKey) {
      const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1024, system, messages }),
      });
      if (!r.ok) return json({ error: `LLM ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502);
      const data = await r.json();
      reply = data.stop_reason === "refusal"
        ? "Desculpe, não consigo responder isso."
        : (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    } else if (openaiKey) {
      const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "system", content: system }, ...messages] }),
      });
      if (!r.ok) return json({ error: `LLM ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502);
      const data = await r.json();
      reply = ((data.choices && data.choices[0] && data.choices[0].message.content) || "").trim();
    } else {
      return json({ error: "Nenhuma chave configurada no servidor. Defina o secret ANTHROPIC_API_KEY (ou OPENAI_API_KEY)." }, 500);
    }
    return json({ reply: reply || "Não consegui formular uma resposta." });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
