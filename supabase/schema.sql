-- =============================================================================
-- Elo Potiguar — Schema do banco (modo Supabase)
-- -----------------------------------------------------------------------------
-- COMO USAR:
--   1. No Supabase, abra  SQL Editor  →  New query
--   2. Cole TODO este arquivo e clique em  Run
--   3. Recarregue o app (ele cria os dados de exemplo sozinho na 1ª vez)
--
-- Modelo: cada tabela guarda o objeto completo em `doc` (jsonb). Isso espelha
-- exatamente os objetos do app, sem precisar mapear campo a campo.
-- =============================================================================

create table if not exists public.users          (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.organizations  (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.needs          (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.donations      (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.deliveries     (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.posts          (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.points_ledger  (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.applications   (id text primary key, doc jsonb not null, created_at timestamptz default now());
create table if not exists public.notifications  (id text primary key, doc jsonb not null, created_at timestamptz default now());

-- -----------------------------------------------------------------------------
-- Acesso + Realtime (protótipo): libera leitura/escrita à chave pública (anon)
-- e a usuários autenticados, e habilita o Realtime em todas as tabelas.
-- ⚠️ PRODUÇÃO: troque a política "elo_all" por regras restritas (RLS real).
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','organizations','needs','donations','deliveries',
    'posts','points_ledger','applications','notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "elo_all" on public.%I;', t);
    execute format('create policy "elo_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
    execute format('grant all on public.%I to anon, authenticated;', t);
    -- replica identity full => Realtime envia a linha completa em UPDATE/DELETE
    execute format('alter table public.%I replica identity full;', t);
    -- adiciona a tabela à publicação do Realtime (ignora se já estiver)
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- Pronto! Recarregue o Elo Potiguar.
