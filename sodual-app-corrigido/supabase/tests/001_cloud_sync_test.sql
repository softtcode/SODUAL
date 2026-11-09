-- =====================================================================================================
-- SODUAL — verificação da migração 001_cloud_sync.sql (isolamento entre contas e controle de revisão)
-- Como usar: Supabase → SQL Editor → cole e execute o arquivo inteiro, DEPOIS de aplicar a migração.
-- Tudo roda numa transação que termina em ROLLBACK: os dois usuários de teste e os dados somem no final.
-- Sucesso: aparece "SODUAL: TODAS AS VERIFICAÇÕES PASSARAM". Qualquer falha interrompe com "FALHOU: ...".
-- Impersonação: SET ROLE authenticated/anon + request.jwt.claims, como o PostgREST faz em cada requisição.
-- =====================================================================================================
begin;

-- Pré-verificação: a migração 001 precisa ter sido aplicada (e confirmada) antes deste teste.
do $$
begin
  if to_regclass('public.sodual_user_data') is null
     or to_regprocedure('public.sodual_sync_put(jsonb,bigint,integer,text)') is null
     or to_regprocedure('public.sodual_sync_delete(bigint)') is null then
    raise exception 'MIGRAÇÃO NÃO APLICADA: rode supabase/migrations/001_cloud_sync.sql no SQL Editor (até o fim, sem erros) e depois este teste.';
  end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'sodual-teste-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'sodual-teste-b@example.invalid');

-- Dados de exemplo no formato do app (S).
create temp table _sod_payload as select
  '{"v":3,"chars":[{"id":"c1","nome":"Lia","mana":9,"manaMax":14,"nucleo":"Preto","w":{"tronco":{"g":2,"h":1,"amp":0,"log":[],"cnt":[0,0,1,0,0,0],"ac":[0,0,0,0,0,0]}},"cb":[]}],"net":{"pos":{},"edges":[],"people":[]},"set":{"nome":"A","perfil":{"titulo":"","bio":"","moldura":"","banner":"","insignias":[]}}}'::jsonb as a,
  '{"v":3,"chars":[],"net":{"pos":{},"edges":[],"people":[]},"set":{"nome":"B"}}'::jsonb as b;
grant select on _sod_payload to authenticated, anon;

-- ---------------------------------------------------------------- usuário A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare r jsonb; p jsonb := (select a from _sod_payload);
begin
  r := public.sodual_sync_put(p, 0, 3, 'Teste A');
  if not (r->>'ok')::boolean or (r->>'revision')::bigint <> 1 then raise exception 'FALHOU: criação inicial de A: %', r; end if;

  r := public.sodual_sync_put(p || '{"v":3}', 1, 3, 'Teste A');
  if (r->>'revision')::bigint <> 2 then raise exception 'FALHOU: atualização com revisão correta: %', r; end if;

  r := public.sodual_sync_put(p, 1, 3, 'Outro dispositivo');               -- revisão antiga
  if (r->>'ok')::boolean or not (r->>'conflict')::boolean or (r->>'revision')::bigint <> 2 then
    raise exception 'FALHOU: escrita com revisão antiga deveria dar conflito: %', r; end if;

  r := public.sodual_sync_put(p, 0, 3, 'Outro dispositivo');               -- "criar" quando já existe
  if (r->>'ok')::boolean or (r->>'revision')::bigint <> 2 then raise exception 'FALHOU: criação duplicada: %', r; end if;

  if (select revision from public.sodual_user_data) <> 2 then raise exception 'FALHOU: A não lê a própria revisão'; end if;
  if (select data->'chars'->0->'w'->'tronco'->>'g' from public.sodual_user_data) <> '2' then
    raise exception 'FALHOU: ferimento não preservado no JSON'; end if;

  begin perform public.sodual_sync_put('{"v":3}', 2, 3, null); raise exception 'FALHOU: payload sem chars aceito';
  exception when sqlstate '22023' then null; end;
  begin perform public.sodual_sync_put(p || '{"refresh_token":"x"}', 2, 3, null); raise exception 'FALHOU: payload com token aceito';
  exception when sqlstate '22023' then null; end;
  begin perform public.sodual_sync_put(p, -1, 3, null); raise exception 'FALHOU: revisão negativa aceita';
  exception when sqlstate '22023' then null; end;

  begin update public.sodual_user_data set revision = 99; raise exception 'FALHOU: UPDATE direto permitido (contorna a revisão)';
  exception when insufficient_privilege then null; end;
  begin perform public.sodual_sync_validate(p, 3); raise exception 'FALHOU: função interna executável pelo cliente';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: A cria, atualiza, recebe conflito com revisão antiga e não escreve direto na tabela';
end $$;
reset role;

-- ---------------------------------------------------------------- usuário B tenta acessar A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare r jsonb; n integer;
begin
  select count(*) into n from public.sodual_user_data;
  if n <> 0 then raise exception 'FALHOU: B enxerga % linha(s) de outra conta', n; end if;
  select count(*) into n from public.sodual_user_data where user_id = '00000000-0000-4000-8000-00000000000a';
  if n <> 0 then raise exception 'FALHOU: B lê os dados de A filtrando pelo id'; end if;

  begin update public.sodual_user_data set data = '{"chars":[]}' where user_id = '00000000-0000-4000-8000-00000000000a';
        raise exception 'FALHOU: B conseguiu UPDATE direto';
  exception when insufficient_privilege then null; end;
  begin insert into public.sodual_user_data (user_id, data, schema_version) values ('00000000-0000-4000-8000-00000000000a', '{"chars":[]}', 3);
        raise exception 'FALHOU: B conseguiu INSERT com o id de A';
  exception when insufficient_privilege then null; end;
  begin delete from public.sodual_user_data where user_id = '00000000-0000-4000-8000-00000000000a';
        raise exception 'FALHOU: B conseguiu DELETE direto';
  exception when insufficient_privilege then null; end;

  -- A função sempre usa auth.uid(): a escrita de B cria a linha de B, nunca toca na de A.
  r := public.sodual_sync_put((select b from _sod_payload), 0, 3, 'Teste B');
  if (r->>'revision')::bigint <> 1 then raise exception 'FALHOU: B não criou a própria linha: %', r; end if;
  r := public.sodual_sync_put((select b from _sod_payload), 2, 3, 'Teste B');   -- revisão de A não serve para B
  if (r->>'ok')::boolean then raise exception 'FALHOU: B usou a revisão de A'; end if;
  r := public.sodual_sync_delete(2);                                                -- revisão de A
  if (r->>'ok')::boolean then raise exception 'FALHOU: exclusão de B com a revisão de A teve efeito: %', r; end if;
  select count(*) into n from public.sodual_user_data;
  if n <> 1 then raise exception 'FALHOU: B deveria ver só a própria linha (viu %)', n; end if;
  raise notice 'OK: B não lê, não altera e não exclui os dados de A';
end $$;
reset role;

-- ---------------------------------------------------------------- sem sessão (anon) e token sem usuário
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin perform 1 from public.sodual_user_data; raise exception 'FALHOU: anon lê a tabela';
  exception when insufficient_privilege then null; end;
  begin perform public.sodual_sync_put('{"chars":[]}', 0, 3, null); raise exception 'FALHOU: anon executa a escrita';
  exception when insufficient_privilege then null;
            when sqlstate '28000' then raise exception 'FALHOU: anon tem permissão de EXECUTE na escrita (só foi barrado por falta de usuário)'; end;
  begin perform public.sodual_sync_delete(1); raise exception 'FALHOU: anon executa a exclusão';
  exception when insufficient_privilege then null;
            when sqlstate '28000' then raise exception 'FALHOU: anon tem permissão de EXECUTE na exclusão (só foi barrado por falta de usuário)'; end;
  raise notice 'OK: sem sessão não há leitura nem escrita';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);   -- autenticado sem "sub"
do $$
begin
  begin perform public.sodual_sync_put('{"chars":[]}', 0, 3, null); raise exception 'FALHOU: escrita sem usuário';
  exception when sqlstate '28000' then null; end;
  raise notice 'OK: token sem usuário é recusado';
end $$;
reset role;

-- ---------------------------------------------------------------- exclusão remota pelo dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  r := public.sodual_sync_delete(1);                          -- revisão antiga: não apaga
  if (r->>'ok')::boolean or not (r->>'conflict')::boolean then raise exception 'FALHOU: exclusão com revisão antiga: %', r; end if;
  r := public.sodual_sync_delete(2);
  if not (r->>'ok')::boolean then raise exception 'FALHOU: dono não excluiu com a revisão atual: %', r; end if;
  r := public.sodual_sync_put((select a from _sod_payload), 2, 3, 'Teste A'); -- dispositivo desatualizado depois da exclusão
  if (r->>'ok')::boolean or (r->>'revision')::bigint <> 0 then raise exception 'FALHOU: escrita após exclusão deveria dar conflito com revisão 0: %', r; end if;
  raise notice 'OK: exclusão remota exige a revisão atual e afeta só o dono';
end $$;
reset role;

-- A linha de B continua intacta (verificado como dono, fora do RLS).
do $$ begin
  if (select count(*) from public.sodual_user_data where user_id = '00000000-0000-4000-8000-00000000000b') <> 1 then
    raise exception 'FALHOU: a linha de B foi afetada'; end if;
  raise notice 'SODUAL: TODAS AS VERIFICAÇÕES PASSARAM';
end $$;

rollback;
