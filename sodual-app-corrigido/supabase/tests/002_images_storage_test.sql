-- =====================================================================================================
-- SODUAL — verificação da migração 002_images_storage.sql (bucket privado e isolamento das imagens)
-- Como usar: Supabase → SQL Editor → cole e execute o arquivo inteiro, DEPOIS de aplicar a migração 002.
-- Tudo roda numa transação que termina em ROLLBACK: usuários e registros de teste somem no final
-- (nenhum arquivo real é criado: só linhas de teste em storage.objects, também desfeitas).
-- Sucesso: aparece "SODUAL: TODAS AS VERIFICAÇÕES DO STORAGE PASSARAM". Qualquer falha interrompe com "FALHOU: ...".
-- =====================================================================================================
begin;

-- Pré-verificação: migração aplicada.
do $$
begin
  if to_regprocedure('public.sodual_image_path_ok(text)') is null
     or not exists (select 1 from storage.buckets where id = 'sodual-images') then
    raise exception 'MIGRAÇÃO NÃO APLICADA: rode supabase/migrations/002_images_storage.sql no SQL Editor (até o fim, sem erros) e depois este teste.';
  end if;
  if (select public from storage.buckets where id = 'sodual-images') then
    raise exception 'FALHOU: o bucket sodual-images está PÚBLICO';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'sodual_images_%') <> 4 then
    raise exception 'FALHOU: esperadas 4 políticas sodual_images_* em storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'sodual_images_%'
             and (roles <> array['authenticated']::name[] or coalesce(qual, with_check) not like '%sodual_image_path_ok%')) then
    raise exception 'FALHOU: alguma política sodual_images_* não é exclusiva de authenticated ou não verifica o caminho';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname not like 'sodual_images_%' and (qual like '%sodual-images%' or with_check like '%sodual-images%')) then
    raise notice 'ATENÇÃO: há outras políticas citando o bucket sodual-images; confira se não liberam acesso a outros usuários.';
  end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a5', 'sodual-storage-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000b5', 'sodual-storage-b@example.invalid');

-- ---------------------------------------------------------------- validação de caminhos (como A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
do $$
declare a text := '00000000-0000-4000-8000-0000000000a5'; b text := '00000000-0000-4000-8000-0000000000b5';
begin
  if not public.sodual_image_path_ok(a || '/profile/avatar/0123456789abcdef0123456789abcdef.jpg') then raise exception 'FALHOU: avatar próprio recusado'; end if;
  if not public.sodual_image_path_ok(a || '/characters/k3x9_z-1/0123456789abcdef.jpg') then raise exception 'FALHOU: retrato próprio recusado'; end if;
  if not public.sodual_image_path_ok(a || '/network/p1/0123456789abcdef.webp') then raise exception 'FALHOU: foto da rede própria recusada'; end if;
  if public.sodual_image_path_ok(b || '/profile/avatar/0123456789abcdef.jpg') then raise exception 'FALHOU: pasta de outro usuário aceita'; end if;
  if public.sodual_image_path_ok(a || '/outros/0123456789abcdef.jpg') then raise exception 'FALHOU: pasta desconhecida aceita'; end if;
  if public.sodual_image_path_ok(a || '/characters/../x/0123456789abcdef.jpg') then raise exception 'FALHOU: caminho com .. aceito'; end if;
  if public.sodual_image_path_ok(a || '/profile/avatar/foto.exe') then raise exception 'FALHOU: nome/extensão inválidos aceitos'; end if;
  if public.sodual_image_path_ok(a || '/profile/avatar/0123456789abcdef.svg') then raise exception 'FALHOU: SVG aceito'; end if;
end $$;

-- ---------------------------------------------------------------- A grava na própria pasta
do $$
declare a text := '00000000-0000-4000-8000-0000000000a5';
begin
  begin
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('sodual-images', a || '/profile/avatar/aaaaaaaaaaaaaaaa.jpg', a::uuid, '{"mimetype":"image/jpeg","size":10}');
  exception
    when insufficient_privilege then raise exception 'FALHOU: A não consegue gravar na própria pasta (%).', sqlerrm;
    when others then raise exception 'INCONCLUSIVO: o banco recusou a gravação direta em storage.objects por outro motivo (% / %). Valide pelo app (README → Entrega 5).', sqlstate, sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------- B grava na própria pasta
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b5","role":"authenticated"}', true);
insert into storage.objects (bucket_id, name, owner, metadata)
values ('sodual-images', '00000000-0000-4000-8000-0000000000b5/characters/c1/bbbbbbbbbbbbbbbb.jpg', '00000000-0000-4000-8000-0000000000b5', '{"mimetype":"image/jpeg","size":10}');

do $$
declare n int; b text := '00000000-0000-4000-8000-0000000000b5'; a text := '00000000-0000-4000-8000-0000000000a5';
begin
  select count(*) into n from storage.objects where bucket_id = 'sodual-images' and name like '00000000-0000-4000-8000-0000000000_5/%';
  if n <> 1 then raise exception 'FALHOU: B deveria ver só o próprio arquivo (viu %)', n; end if;
  -- B tenta gravar na pasta de A
  begin
    insert into storage.objects (bucket_id, name, owner) values ('sodual-images', a || '/profile/avatar/cccccccccccccccc.jpg', b::uuid);
    raise exception 'FALHOU: B gravou na pasta de A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- A não lê, não altera e não move arquivos de B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
do $$
declare n int; a text := '00000000-0000-4000-8000-0000000000a5';
begin
  select count(*) into n from storage.objects where bucket_id = 'sodual-images' and name like '00000000-0000-4000-8000-0000000000_5/%';
  if n <> 1 then raise exception 'FALHOU: A deveria ver só o próprio arquivo (viu %)', n; end if;
  if exists (select 1 from storage.objects where name like '00000000-0000-4000-8000-0000000000b5/%') then
    raise exception 'FALHOU: A enxerga arquivos de B'; end if;

  update storage.objects set metadata = '{"x":1}' where name like '00000000-0000-4000-8000-0000000000b5/%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: A alterou arquivo de B'; end if;

  -- A tenta "mover" o próprio arquivo para a pasta de B
  begin
    update storage.objects set name = '00000000-0000-4000-8000-0000000000b5/profile/avatar/aaaaaaaaaaaaaaaa.jpg'
     where name = a || '/profile/avatar/aaaaaaaaaaaaaaaa.jpg';
    raise exception 'FALHOU: A moveu um arquivo para a pasta de B';
  exception when insufficient_privilege then null;
  end;

  update storage.objects set metadata = '{"mimetype":"image/jpeg","size":11}' where name = a || '/profile/avatar/aaaaaaaaaaaaaaaa.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: A não consegue atualizar o próprio arquivo'; end if;
end $$;

-- ---------------------------------------------------------------- sem sessão (anon)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'sodual-images';
  if n <> 0 then raise exception 'FALHOU: anon enxerga imagens (%).', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('sodual-images', '00000000-0000-4000-8000-0000000000a5/profile/avatar/dddddddddddddddd.jpg');
    raise exception 'FALHOU: anon gravou imagem';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.sodual_image_path_ok('x');
    raise exception 'FALHOU: anon pode executar sodual_image_path_ok';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin raise notice 'SODUAL: TODAS AS VERIFICAÇÕES DO STORAGE PASSARAM'; end $$;
rollback;
-- O SQL Editor mostra só o resultado da última consulta: esta linha só é alcançada se nenhuma verificação falhou.
select 'SODUAL: TODAS AS VERIFICAÇÕES DO STORAGE PASSARAM' as resultado;
