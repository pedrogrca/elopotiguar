-- =============================================================================
-- Elo Potiguar — Autenticação server-side (ENDURECIMENTO DE PRODUÇÃO, opcional)
-- -----------------------------------------------------------------------------
-- Move a senha para o servidor: hashing com bcrypt (pgcrypto) e verificação via
-- funções RPC SECURITY DEFINER. A tabela de credenciais fica BLOQUEADA por RLS,
-- então a chave pública (anon) NÃO consegue ler os hashes — só as funções podem.
--
-- COMO USAR:
--   1. Rode este script no SQL Editor do Supabase (depois do schema.sql).
--   2. No app, em assets/js/config.js, defina  backend.serverAuth = true
--      (a ser ligado quando você quiser migrar do hashing no cliente para o
--       servidor). Enquanto false, o app usa PBKDF2 no cliente.
-- =============================================================================

create extension if not exists pgcrypto;

-- Tabela isolada de credenciais (nunca exposta ao cliente)
create table if not exists public.app_credentials (
  user_id    text primary key,
  email      text unique not null,
  pass_hash  text not null,
  created_at timestamptz default now()
);

-- Bloqueia TODO acesso direto da chave pública/autenticada.
alter table public.app_credentials enable row level security;
revoke all on public.app_credentials from anon, authenticated;
-- (sem policies => ninguém acessa a tabela diretamente; só as funções abaixo)

-- Cria a credencial (no cadastro). Falha se o e-mail já existir.
create or replace function public.register_credential(p_user_id text, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_password,'')) < 8 then
    raise exception 'Senha muito curta';
  end if;
  insert into public.app_credentials(user_id, email, pass_hash)
  values (p_user_id, lower(p_email), crypt(p_password, gen_salt('bf', 12)));
exception when unique_violation then
  raise exception 'E-mail já cadastrado';
end;
$$;

-- Verifica e-mail+senha. Retorna o user_id se válido, senão NULL.
create or replace function public.verify_credential(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare uid text;
begin
  select user_id into uid
  from public.app_credentials
  where email = lower(p_email)
    and pass_hash = crypt(p_password, pass_hash);
  return uid;  -- NULL se não bater
end;
$$;

-- Só estas funções são expostas à chave pública.
grant execute on function public.register_credential(text, text, text) to anon, authenticated;
grant execute on function public.verify_credential(text, text)         to anon, authenticated;

-- (Opcional) Semeia as credenciais das contas de demonstração (senha: 123456).
-- IDs deterministas do seed: use_1..use_7.
insert into public.app_credentials(user_id, email, pass_hash) values
  ('use_1','ana@casadobem.org',     crypt('123456', gen_salt('bf',12))),
  ('use_2','bruno@maos.org',        crypt('123456', gen_salt('bf',12))),
  ('use_5','marina@exemplo.com',    crypt('123456', gen_salt('bf',12))),
  ('use_6','carlos@exemplo.com',    crypt('123456', gen_salt('bf',12))),
  ('use_7','joao@exemplo.com',      crypt('123456', gen_salt('bf',12)))
on conflict (email) do nothing;
