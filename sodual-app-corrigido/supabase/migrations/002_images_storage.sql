-- =====================================================================================================
-- SODUAL — Entrega 5: imagens no Supabase Storage PRIVADO
-- Como usar: Supabase → SQL Editor → cole e execute o arquivo inteiro (depois da 001). Pode ser executado de novo.
--
-- O que faz:
--   1. Cria (ou corrige) o bucket "sodual-images" como PRIVADO, com limite de 1 MB por arquivo e só JPEG/PNG/WebP.
--   2. Cria políticas RLS em storage.objects: cada usuário autenticado só envia, lê, atualiza e remove arquivos
--      dentro da própria pasta  <auth.uid()>/...  e só nos caminhos que o app usa:
--         <uid>/profile/avatar/<hash>.jpg
--         <uid>/characters/<id-da-ficha>/<hash>.jpg
--         <uid>/network/<id-da-pessoa>/<hash>.jpg
--   anon (sem sessão) não recebe nenhuma política: não lê nem grava nada.
--
-- O que NÃO faz: não apaga buckets, arquivos ou tabelas; não liga RLS em tabelas do sistema (o Supabase já mantém RLS
-- ativo em storage.objects); não cria funções SECURITY DEFINER; não usa service_role.
-- =====================================================================================================

-- 1) Bucket privado. Se já existir um bucket com este nome, ele é mantido e apenas forçado a PRIVADO com os limites abaixo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sodual-images', 'sodual-images', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Caminho permitido (função pura, sem privilégios especiais): pasta do próprio usuário + formato esperado.
--    O primeiro segmento precisa ser exatamente o uid do usuário da requisição.
create or replace function public.sodual_image_path_ok(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and p_name is not null
     and split_part(p_name, '/', 1) = auth.uid()::text
     and p_name ~ '^[0-9a-f-]{36}/(profile/avatar|characters/[A-Za-z0-9_-]{1,64}|network/[A-Za-z0-9_-]{1,64})/[0-9a-f]{16,64}\.(jpg|png|webp)$'
$$;
revoke all on function public.sodual_image_path_ok(text) from public, anon;
grant execute on function public.sodual_image_path_ok(text) to authenticated;

-- 3) Políticas (recriadas com o mesmo nome para a migração poder ser executada de novo; só afetam o bucket sodual-images).
drop policy if exists "sodual_images_select_own" on storage.objects;
drop policy if exists "sodual_images_insert_own" on storage.objects;
drop policy if exists "sodual_images_update_own" on storage.objects;
drop policy if exists "sodual_images_delete_own" on storage.objects;

create policy "sodual_images_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'sodual-images' and public.sodual_image_path_ok(name));

create policy "sodual_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sodual-images' and public.sodual_image_path_ok(name));

create policy "sodual_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'sodual-images' and public.sodual_image_path_ok(name))
  with check (bucket_id = 'sodual-images' and public.sodual_image_path_ok(name));

create policy "sodual_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sodual-images' and public.sodual_image_path_ok(name));
