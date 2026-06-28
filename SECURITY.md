# 🔒 Segurança & LGPD — Elo Potiguar

Documento-resumo das medidas de segurança e privacidade da plataforma.
Pensado para servir de base para os slides da apresentação.

---

## 1. Segurança da conta (autenticação)

| Medida | Como está implementado |
|---|---|
| **Hash de senha forte** | Cadastros usam **PBKDF2-HMAC-SHA256**, **150.000 iterações** e **salt aleatório de 16 bytes por usuário** (Web Crypto API). A senha **nunca** é guardada em texto. |
| **Comparação segura** | Verificação com comparação de tempo ~constante (mitiga *timing attacks*). |
| **Política de senha** | Mínimo de 8 caracteres, com letra e número; bloqueio de senhas comuns; **medidor de força** em tempo real no cadastro. |
| **Anti-enumeração de usuários** | Login sempre retorna a mesma mensagem genérica ("E-mail ou senha incorretos"), com atraso artificial — não revela se o e-mail existe. |
| **Validação de entrada** | E-mail validado por formato; campos sanitizados (escape de HTML) para evitar XSS. |
| **Transporte** | Servido por **HTTPS** em produção (obrigatório para GPS e Supabase). |

## 2. Privacidade desde a concepção (LGPD)

| Princípio (LGPD) | Como aplicamos |
|---|---|
| **Consentimento** (art. 7º, I) | Checkbox **obrigatório** no cadastro, com aceite da Política de Privacidade e Termos; registramos data/hora e versão do consentimento. |
| **Finalidade & Transparência** (art. 6º) | Página de Privacidade lista **cada dado coletado e o porquê**. |
| **Minimização** (art. 6º, III) | Coletamos só o necessário; habilidades/interesses são **opcionais**. |
| **Direito de acesso/portabilidade** (art. 18) | "Meus dados" permite **exportar tudo em JSON**. |
| **Direito de eliminação** (art. 18, VI) | "Excluir minha conta": remove dados pessoais e **anonimiza** o histórico de doações. |
| **Localização** | GPS do entregador é compartilhado **apenas durante a entrega**. |
| **Encarregado (DPO)** | Canal de contato publicado na Política (`privacidade@elopotiguar.org`). |

> Tudo é configurável em [`assets/js/config.js`](assets/js/config.js) → bloco `legal`.

## 3. Segurança de dados (backend Supabase)

- Banco **PostgreSQL gerenciado** (Supabase), acesso por **HTTPS** com **chave pública** (não há segredo no navegador).
- **RLS (Row Level Security)** habilitada em todas as tabelas.
- Comunicação em tempo real (GPS/status) por canais autenticados do Supabase Realtime.

## 4. Roteiro de endurecimento para produção (próximos passos)

Itens já planejados/prontos para ativar antes do lançamento público:

1. **Verificação de senha no servidor** — mover o hash para o Postgres com **bcrypt (pgcrypto)** via função **RPC `SECURITY DEFINER`**, com a tabela de credenciais **bloqueada por RLS** (a senha nunca sai do servidor). Script pronto em [`supabase/secure-auth.sql`](supabase/secure-auth.sql).
2. **RLS por usuário (autorização)** — adotar **Supabase Auth (JWT)** para que cada pessoa só acesse/edite os próprios dados (`auth.uid()`), substituindo as políticas permissivas do protótipo.
3. **Rate limiting / proteção a brute force** no login (ex.: Supabase Edge Functions + bloqueio temporário).
4. **Verificação de e-mail** e **redefinição de senha** (nativos do Supabase Auth).
5. **Auditoria/Logs** de acessos e consentimentos.
6. **Pagamentos** com gateway certificado (PIX/Mercado Pago/Stripe) — PCI fora do nosso escopo (delegado ao provedor).

## 5. Frase-resumo para o slide

> "Privacidade desde a concepção: senhas com PBKDF2, consentimento e transparência LGPD,
> direito de exportar e excluir os próprios dados, e GPS compartilhado apenas durante a entrega —
> com um caminho claro de endurecimento (bcrypt no servidor + RLS por usuário) para produção."
