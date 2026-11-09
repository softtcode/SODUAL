-- =====================================================================================================
-- SODUAL — 001_cloud_sync.sql  (Entrega 1: banco e segurança)
-- Estado persistente de cada conta (o mesmo objeto S do app, sem dados de autenticação) com controle de revisão.
--
-- Modelo de segurança:
--   * RLS ativo: cada conta só enxerga a própria linha (auth.uid() = user_id).
--   * O cliente (role "authenticated") só tem SELECT direto na tabela. Toda escrita passa pelas funções
--     sodual_sync_put / sodual_sync_delete, que exigem a revisão esperada (concorrência otimista).
--     Assim ninguém contorna o controle de revisão com um UPDATE direto via PostgREST.
--   * As funções são SECURITY DEFINER com search_path vazio, nomes totalmente qualificados, e usam SEMPRE
--     auth.uid() do token — nunca um user_id enviado pelo cliente. EXECUTE só para "authenticated".
--   * "anon" e "public" não têm nenhum acesso.
--
-- Não destrutiva: só CREATE ... IF NOT EXISTS / CREATE OR REPLACE. Nenhum DROP de tabela, nenhum dado apagado.
-- Pode ser executada mais de uma vez (idempotente).
-- =====================================================================================================

begin;

-- ---------------------------------------------------------------------------------------------------
-- 1) Tabela: uma linha por conta.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.sodual_user_data (
  user_id            uuid        primary key references auth.users (id) on delete cascade,
  data               jsonb       not null,
  revision           bigint      not null default 1,
  schema_version     integer     not null,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_by_device  text,
  constraint sodual_user_data_data_object    check (jsonb_typeof(data) = 'object'),
  constraint sodual_user_data_revision_pos   check (revision >= 1),
  constraint sodual_user_data_schema_range   check (schema_version between 1 and 1000),
  constraint sodual_user_data_device_len     check (updated_by_device is null or char_length(updated_by_device) <= 80)
);

comment on table  public.sodual_user_data is 'Estado do SODUAL por conta (objeto S, sem credenciais). Escrita só via sodual_sync_put/sodual_sync_delete.';
comment on column public.sodual_user_data.revision is 'Incrementada atomicamente a cada escrita aceita. Usada para concorrência otimista; nunca usar updated_at para isso.';
comment on column public.sodual_user_data.updated_by_device is 'Rótulo legível do dispositivo que fez a última escrita (ex.: "Chrome · Windows"). Informativo.';

-- A chave primária (user_id) já é o único índice necessário: toda consulta é por user_id.

-- ---------------------------------------------------------------------------------------------------
-- 2) Row Level Security.
-- ---------------------------------------------------------------------------------------------------
alter table public.sodual_user_data enable row level security;
-- Sem FORCE de propósito: as funções SECURITY DEFINER rodam como dono da tabela e filtram explicitamente por auth.uid().
-- Com FORCE, o dono ficaria sujeito às políticas "to authenticated" e as escritas legítimas seriam bloqueadas.

drop policy if exists sodual_user_data_select_own on public.sodual_user_data;
drop policy if exists sodual_user_data_insert_own on public.sodual_user_data;
drop policy if exists sodual_user_data_update_own on public.sodual_user_data;
drop policy if exists sodual_user_data_delete_own on public.sodual_user_data;

-- (select auth.uid()) é avaliado uma vez por consulta (recomendação de desempenho do Supabase).
create policy sodual_user_data_select_own on public.sodual_user_data
  for select to authenticated using ((select auth.uid()) = user_id);
-- As políticas de escrita existem como defesa em profundidade; o cliente não tem privilégio de escrita direta (ver grants).
create policy sodual_user_data_insert_own on public.sodual_user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sodual_user_data_update_own on public.sodual_user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sodual_user_data_delete_own on public.sodual_user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------------
-- 3) Privilégios mínimos. O Supabase concede ALL a anon/authenticated por padrão em tabelas novas do schema
--    public; revogamos tudo e devolvemos só SELECT para usuários autenticados.
-- ---------------------------------------------------------------------------------------------------
revoke all on table public.sodual_user_data from public, anon, authenticated;
grant select on table public.sodual_user_data to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 4) Validação do payload (função auxiliar, sem acesso a tabelas).
--    Exige o formato básico do estado do app e recusa chaves de autenticação no nível superior.
--    Limite: 4 MB de JSON (o app ainda guarda imagens em base64; ver README — Entrega 5 move imagens para o Storage).
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sodual_sync_validate(p_data jsonb, p_schema_version integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'sodual: payload deve ser um objeto JSON' using errcode = '22023';
  end if;
  if not (p_data ? 'chars') or jsonb_typeof(p_data -> 'chars') <> 'array' then
    raise exception 'sodual: payload sem a lista "chars"' using errcode = '22023';
  end if;
  if (p_data ? 'set') and jsonb_typeof(p_data -> 'set') <> 'object' then
    raise exception 'sodual: "set" deve ser um objeto' using errcode = '22023';
  end if;
  if (p_data ? 'net') and jsonb_typeof(p_data -> 'net') <> 'object' then
    raise exception 'sodual: "net" deve ser um objeto' using errcode = '22023';
  end if;
  if p_data ?| array['access_token', 'refresh_token', 'session', 'password', 'senha', 'provider_token', 'service_role'] then
    raise exception 'sodual: payload contém campos de autenticação' using errcode = '22023';
  end if;
  if p_schema_version is null or p_schema_version not between 1 and 1000 then
    raise exception 'sodual: schema_version inválida' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > 4 * 1024 * 1024 then
    raise exception 'sodual: payload acima de 4 MB' using errcode = '54000';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5) Escrita com controle de revisão.
--    p_expected_revision = 0  → criar a linha (só se ainda não existir).
--    p_expected_revision = N  → atualizar só se a revisão atual for N; a nova revisão é N+1.
--    Retorno (jsonb):
--      { "ok": true,  "revision": R, "updated_at": T }
--      { "ok": false, "conflict": true, "revision": R_atual_ou_0, "updated_at": T_ou_null, "updated_by_device": D }
--    Erros (exceções): não autenticado (28000) e payload inválido (22023 / 54000) — não são conflitos.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sodual_sync_put(
  p_data              jsonb,
  p_expected_revision bigint,
  p_schema_version    integer,
  p_device            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_rev    bigint;
  v_at     timestamptz;
  v_dev    text := nullif(left(btrim(coalesce(p_device, '')), 80), '');
  v_cur    record;
begin
  if v_uid is null then
    raise exception 'sodual: não autenticado' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'sodual: revisão esperada inválida' using errcode = '22023';
  end if;
  perform public.sodual_sync_validate(p_data, p_schema_version);

  if p_expected_revision = 0 then
    insert into public.sodual_user_data as t (user_id, data, revision, schema_version, updated_at, updated_by_device)
    values (v_uid, p_data, 1, p_schema_version, now(), v_dev)
    on conflict (user_id) do nothing
    returning t.revision, t.updated_at into v_rev, v_at;
  else
    -- UPDATE condicional é atômico: duas escritas concorrentes com a mesma revisão esperada → só uma vence.
    update public.sodual_user_data as t
       set data = p_data,
           revision = t.revision + 1,
           schema_version = p_schema_version,
           updated_at = now(),
           updated_by_device = v_dev
     where t.user_id = v_uid
       and t.revision = p_expected_revision
    returning t.revision, t.updated_at into v_rev, v_at;
  end if;

  if v_rev is not null then
    return jsonb_build_object('ok', true, 'revision', v_rev, 'updated_at', v_at);
  end if;

  -- Conflito: devolve a revisão atual (0 se a linha não existe mais) para o cliente decidir, sem sobrescrever nada.
  select t.revision, t.updated_at, t.updated_by_device into v_cur
    from public.sodual_user_data t where t.user_id = v_uid;
  return jsonb_build_object('ok', false, 'conflict', true,
                            'revision', coalesce(v_cur.revision, 0),
                            'updated_at', v_cur.updated_at,
                            'updated_by_device', v_cur.updated_by_device);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 6) Exclusão dos dados da NUVEM (não exclui a conta de autenticação nem dados locais).
--    Também exige a revisão esperada, para não apagar alterações feitas por outro dispositivo.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sodual_sync_delete(p_expected_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
  v_cur record;
begin
  if v_uid is null then
    raise exception 'sodual: não autenticado' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'sodual: revisão esperada inválida' using errcode = '22023';
  end if;
  delete from public.sodual_user_data t where t.user_id = v_uid and t.revision = p_expected_revision;
  get diagnostics v_n = row_count;
  if v_n = 1 then
    return jsonb_build_object('ok', true, 'deleted', true);
  end if;
  select t.revision, t.updated_at into v_cur from public.sodual_user_data t where t.user_id = v_uid;
  return jsonb_build_object('ok', false, 'conflict', v_cur.revision is not null,
                            'revision', coalesce(v_cur.revision, 0), 'updated_at', v_cur.updated_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 7) Permissões das funções: só usuários autenticados executam as funções públicas; a validação é interna.
-- ---------------------------------------------------------------------------------------------------
revoke all on function public.sodual_sync_validate(jsonb, integer)                from public, anon, authenticated;
revoke all on function public.sodual_sync_put(jsonb, bigint, integer, text)      from public, anon;
revoke all on function public.sodual_sync_delete(bigint)                         from public, anon;
grant execute on function public.sodual_sync_put(jsonb, bigint, integer, text)   to authenticated;
grant execute on function public.sodual_sync_delete(bigint)                      to authenticated;

commit;

-- ROLLBACK SEGURO (manual, só se necessário e DEPOIS de exportar os dados):
--   revoke execute on function public.sodual_sync_put(jsonb, bigint, integer, text) from authenticated;
--   revoke execute on function public.sodual_sync_delete(bigint) from authenticated;
-- Isso desliga a escrita na nuvem sem apagar nada; o app continua salvando localmente.
-- Apagar a tabela é uma decisão separada e destrutiva — não faça sem backup.
