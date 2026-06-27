# 🤝 Elo Potiguar — Plataforma de Beneficência

> Conectando **doadores** e **voluntários** a **organizações**, unindo habilidades, interesses e
> recursos às necessidades de quem mais precisa — com **transparência total** e **acompanhamento
> em tempo real** (estilo iFood, com GPS e código de segurança).

Aplicação web completa e **funcional**, feita em **HTML, CSS e JavaScript puro** (sem framework,
sem etapa de build e **sem precisar instalar nada**). Os dados ficam no `localStorage` do navegador,
o tempo real usa `BroadcastChannel`, o mapa usa **Leaflet/OpenStreetMap** e a geolocalização usa a
**Geolocation API** do navegador.

---

## 📑 Índice
1. [O que está implementado](#-o-que-está-implementado)
2. [Contas de demonstração](#-contas-de-demonstração)
3. [Como executar](#-como-executar)
4. [Como customizar](#-como-customizar)
5. [Estrutura do projeto](#-estrutura-do-projeto)
6. [Arquitetura técnica](#-arquitetura-técnica)
7. [Como fazer o deploy](#-como-fazer-o-deploy)
8. [Evoluir para um backend real](#-evoluir-para-um-backend-real)
9. [Limitações conhecidas](#-limitações-conhecidas)

---

## ✅ O que está implementado

Cada item abaixo corresponde diretamente ao que foi pedido:

### 1. União de voluntários/doadores ↔ organizações
- **Cadastro com múltiplos papéis** (`Doador`, `Voluntário`, `Entregador`, `Organização`) — uma
  mesma pessoa pode ter vários papéis (ex.: doar **e** se voluntariar).
- **Diretório de organizações** com busca e filtro por categoria.

### 2. Matching de habilidades, interesses e recursos + priorização de vulnerabilidade
- **Algoritmo de matching** (`assets/js/logic.js`) que pontua cada necessidade de voluntariado
  conforme: habilidades em comum, interesses/causa, urgência, **vulnerabilidade da organização** e
  localização (mesma cidade). O voluntário vê as oportunidades ordenadas por compatibilidade, com a
  explicação do porquê de cada match.
- **Priorização por vulnerabilidade**: organizações em maior situação de vulnerabilidade (e com
  necessidades mais urgentes) aparecem primeiro na home e na lista. Para doadores logados, também
  considera os **interesses** declarados.
- **Candidatura com laço fechado**: ao se candidatar a uma vaga de voluntário, a candidatura é
  **registrada** e a organização a recebe numa **caixa de entrada** (aba "Voluntários"), onde pode
  **aceitar ou recusar** — e o voluntário é **notificado** da resposta.

### 3. Acompanhamento transparente da doação (Recebido → Em estoque → Usado)
- Ao doar, o doador acompanha uma **linha do tempo** com os status configuráveis:
  `Pendente → (Em rota) → Recebido → Em estoque → Usado`.
- Cada mudança de status registra **data/hora**, **quem alterou** e uma **observação** visível ao
  doador (ex.: "distribuídas para 20 famílias"), garantindo que o recurso foi de fato utilizado para
  o propósito proposto.
- **Transparência do dinheiro**: em doações financeiras, a organização **detalha a alocação** (em que
  cada parte foi gasta, com comprovante). O doador vê o desdobramento com barra de progresso
  (doado / aplicado / a aplicar).

### 4. Sistema de Pontos de Confiança (credibilidade)
- A organização **confirma o recebimento** e o **uso** do recurso, ganhando pontos a cada etapa.
- Pode (opcionalmente) **publicar uma postagem de impacto**, que rende **mais pontos**.
- Os pontos definem o **nível de credibilidade** (`Nova → Confiável → Reconhecida → Referência`),
  exibido em selos e num **ranking público** — o que tende a atrair mais doações.
- Há um **histórico de pontos** transparente no painel da organização.

### 5. Entregador voluntário + mediação por código + GPS em tempo real (estilo iFood)
- Ao doar itens materiais, o doador pode pedir um **entregador voluntário**.
- O entregador vê as **entregas disponíveis**, **aceita** uma e acompanha tudo num **mapa**.
- **GPS em tempo real**: o entregador pode usar o **GPS real do dispositivo** ou **simular o trajeto**
  (para demonstração). A posição é transmitida ao vivo e o doador/organização veem o marcador se
  movendo no mapa.
- **Código de segurança de 4 dígitos** (estilo iFood): a doação só é confirmada como entregue quando
  o entregador digita o código informado por quem recebe — e isso avança a doação automaticamente
  para "Recebido".

### 6. Notificações em tempo real (🔔)
- Um **sininho** no topo mostra avisos por usuário: mudança de status da doação, entrega aceita,
  entrega concluída, nova doação recebida, **nova candidatura de voluntário**, candidatura
  aceita/recusada, **nova alocação financeira** e postagem de impacto. O contador de não lidas
  atualiza ao vivo (inclusive entre abas).

### Telas implementadas
Home (hero + estatísticas + prioridades + ranking + impacto + "como funciona") · Lista de
organizações (busca/filtro) · Página da organização (necessidades, postagens, credibilidade) ·
Formulário de doação (material/financeira, com opção de entrega) · Acompanhamento da doação
(linha do tempo + mapa ao vivo) · Login · Cadastro · Painéis por papel (Doador, Organização,
Voluntário, Entregador) · Feed de impacto.

---

## 🔑 Contas de demonstração

A senha de **todas** as contas é **`123456`**. Na tela de login há botões de acesso rápido.

| Papel | Nome | E-mail |
|------|------|--------|
| 💝 Doadora | Marina Souza | `marina@exemplo.com` |
| 🙋 Voluntário + Doador | Carlos Lima | `carlos@exemplo.com` |
| 🛵 Entregador + Voluntário | João Mota | `joao@exemplo.com` |
| 🏛️ Organização (Casa do Bem) | Ana Ferreira | `ana@casadobem.org` |
| 🏛️ Organização (Mãos que Acolhem) | Bruno Alves | `bruno@maos.org` |

> Já vem com dados de exemplo: 4 organizações, várias necessidades, doações em diferentes status,
> **uma entrega ativa com GPS** e postagens de impacto.

### Roteiro de demonstração sugerido
1. **Entregador** (João) → painel → **"Entrega ativa"** → clique **"▶ Simular trajeto (GPS)"** e veja
   o 🛵 andar no mapa de Natal. Ao chegar, clique **"✅ Confirmar entrega"** e digite o código.
2. **Doador** (Marina) → "Minhas doações" → abra a doação em entrega → veja o **mapa ao vivo** e o
   **código de segurança**. (Dica: abra em duas abas, uma como João e outra como Marina, para ver o
   movimento em tempo real entre elas.)
3. **Organização** (Ana) → painel → "Doações recebidas" → marque **Em estoque** / **Usado** e veja os
   **pontos subirem**; depois **"📣 Publicar impacto"**.
4. **Voluntário** (Carlos) → painel → veja as **oportunidades compatíveis** com pontuação de match.
5. **Laço do voluntário + 🔔**: como Carlos, clique **"Quero ajudar"** numa vaga; entre como a
   **organização** → aba **"Voluntários"** → **Aceitar**; volte como Carlos e veja a resposta no
   **sininho** e em "Minhas candidaturas".
6. **Transparência do dinheiro**: como **Ana**, em uma doação **financeira** clique **"💰 Detalhar
   alocação"**; como a **doadora**, abra a doação e veja **"Para onde foi o recurso"** com a barra de
   progresso.

---

## 🚀 Como executar

A aplicação é **100% estática** — não precisa de Node, banco de dados ou instalação.

### Opção A — Abrir direto (mais simples)
Dê **duplo-clique** em `index.html`. Funciona para uso em uma aba.
> Observação: abrindo via `file://`, o **tempo real entre abas** pode ficar limitado e o mapa
> precisa de internet. Para a experiência completa, prefira a Opção B.

### Opção B — Servidor local (recomendado) — você já tem Python
No **PowerShell**, dentro da pasta do projeto:
```powershell
py -m http.server 8000
```
Depois abra: **http://localhost:8000**

Assim o site roda em `http://localhost` (mesma origem), habilitando o tempo real entre abas,
`localStorage` compartilhado e o mapa do Leaflet.

### Opção C — Com Node.js (caso instale no futuro)
```powershell
npx serve .
# ou
npx http-server -p 8000
```

> **Resetar os dados:** clique no ícone **⚙️** (canto superior direito) → *"Recarregar dados de
> exemplo"* ou *"Limpar tudo"*.

---

## 🎨 Como customizar

Quase tudo é configurável **num único arquivo**: [`assets/js/config.js`](assets/js/config.js).
Edite e recarregue a página (use ⚙️ → "Recarregar dados de exemplo" se mudar regras de pontos).

| O que você quer mudar | Onde, em `config.js` |
|---|---|
| Nome, slogan, emoji, região | `app` |
| Cores do tema | `theme` (refletem automaticamente no CSS) |
| **Status de doação** (adicionar/remover/renomear, cor, ícone) | `donationStatuses` |
| Status de entrega | `deliveryStatuses` |
| **Quantos pontos cada ação vale** | `points` |
| Níveis de credibilidade | `trustTiers` |
| Tipos de necessidade | `needTypes` |
| Categorias, habilidades, interesses | `categories`, `skills`, `interests` |
| **Pesos do algoritmo de matching** | `matching` |
| Centro/zoom do mapa, intervalo do GPS | `map` |
| Senha das contas demo | `demoPassword` |

Exemplos:
- **Adicionar um status** "Em triagem": acrescente um item em `donationStatuses` (a linha do tempo se
  adapta sozinha).
- **Valorizar mais o uso comprovado**: aumente `points.useDonation`.
- **Priorizar habilidade no matching**: aumente `matching.wSkill`.

Personalizações mais profundas: telas em `assets/js/views.js`, componentes em
`assets/js/components.js`, regras em `assets/js/logic.js`, estilos em `assets/css/styles.css`.

---

## 📁 Estrutura do projeto

```
EloPotiguar/
├── index.html                # Página única (carrega tudo na ordem certa)
├── README.md                 # Este relatório
├── .claude/launch.json       # Config do preview (servidor estático via Python)
└── assets/
    ├── css/
    │   └── styles.css         # Todo o visual (usa variáveis de tema)
    └── js/
        ├── config.js          # ⚙️ CUSTOMIZAÇÃO (marca, status, pontos, matching...)
        ├── ui.js              # Helpers de DOM, toast, modal, formatação
        ├── bus.js             # Barramento de eventos em tempo real (entre abas)
        ├── db.js              # "Banco de dados" em localStorage + dados de exemplo
        ├── auth.js            # Cadastro, login e sessão
        ├── logic.js           # Regras: matching, pontos, doação, entregas
        ├── components.js      # Peças de UI reutilizáveis + Mapa de GPS
        ├── views.js           # Todas as telas (páginas)
        └── app.js             # Roteador (hash), cabeçalho e inicialização
```

---

## 🏗️ Arquitetura técnica

- **Sem build, sem dependências de instalação.** Os arquivos JS expõem módulos sob um único objeto
  global `EP` (`EP.config`, `EP.db`, `EP.auth`, `EP.logic`, `EP.views`, `EP.app`...), carregados por
  `<script>` na ordem certa.
- **Camada de dados desacoplada** (`db.js`): a API (`all/get/insert/update/remove/query`) imita um
  repositório. Para trocar por um backend real, basta reimplementar esses métodos chamando uma API
  HTTP — **sem alterar o resto do app**.
- **Roteador por hash** (`app.js`): URLs como `#/organizacoes`, `#/org/:id`, `#/doacao/:id`,
  `#/painel?tab=org`. Inclui *cleanup* automático (limpa intervalos, GPS e listeners ao trocar de
  tela).
- **Tempo real** (`bus.js`): combina listeners locais + `BroadcastChannel` + evento `storage`, para
  funcionar na mesma aba e **entre abas**.
- **Mapa resiliente** (`components.js` → `GpsMap`): usa **Leaflet** quando há internet; se o Leaflet
  não carregar, cai para um **mapa desenhado em `<canvas>`** (a feature de GPS continua funcionando
  offline).
- **Segurança (demonstração):** o hash de senha é didático e roda no navegador. Em produção, mova a
  autenticação para o servidor com `bcrypt`/`argon2`.

---

## 🌐 Como fazer o deploy

Por ser um site **estático**, o deploy é trivial e gratuito. Escolha uma opção:

### 1. Netlify (arrastar e soltar) — mais fácil
1. Acesse <https://app.netlify.com/drop>.
2. **Arraste a pasta `EloPotiguar`** inteira para a página.
3. Pronto: você recebe uma URL pública (ex.: `https://elo-potiguar.netlify.app`).

### 2. Vercel
```powershell
npm i -g vercel   # requer Node
vercel            # na pasta do projeto; aceite os padrões (framework: "Other")
```

### 3. GitHub Pages
```powershell
git init
git add .
git commit -m "Elo Potiguar"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/elo-potiguar.git
git push -u origin main
```
No GitHub: **Settings → Pages → Source: `main` / root → Save**. O site sai em
`https://SEU_USUARIO.github.io/elo-potiguar/`.

### 4. Surge
```powershell
npm i -g surge   # requer Node
surge .          # escolha um domínio .surge.sh
```

> Não há variáveis de ambiente nem passo de build. Qualquer hospedagem de arquivos estáticos serve
> (Cloudflare Pages, Firebase Hosting, S3, etc.).

---

## 🔁 Evoluir para um backend real

Quando quiser multiusuário de verdade (dados compartilhados entre dispositivos), o caminho natural:

1. Suba uma API (Node/Express, ou Supabase/Firebase) com as coleções já modeladas em `db.js`
   (`users`, `organizations`, `needs`, `donations`, `deliveries`, `posts`, `pointsLedger`).
2. Reescreva **apenas** `db.js` para chamar a API (`fetch`) em vez do `localStorage`.
3. Para GPS em tempo real entre dispositivos, troque o `BroadcastChannel` por **WebSocket**/SSE em
   `bus.js`.
4. Mova `auth.js` (hash de senha, emissão de token) para o servidor.

O restante (telas, lógica de negócio, matching, pontos) permanece praticamente inalterado.

---

## ⚠️ Limitações conhecidas

- **Persistência local:** os dados ficam no `localStorage` do navegador (ótimo para demonstração e
  uso de uma máquina). Para compartilhar dados entre pessoas/dispositivos, veja a seção acima.
- **Pagamentos** são simulados (nenhuma cobrança real).
- **Autenticação** é didática (client-side). Não use as senhas demo em produção.
- **Mapa Leaflet** requer internet; sem ela, o app usa o mapa de fallback em canvas.
- **GPS real** depende da permissão de localização do navegador; coordenadas reais ficarão distantes
  do trajeto fictício de Natal (use "Simular trajeto" para a demonstração).

---

Feito com 💚 para o Rio Grande do Norte.
