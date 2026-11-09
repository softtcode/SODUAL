// Validação LOCAL da migração em PostgreSQL real (PGlite = Postgres em WebAssembly), sem Docker nem projeto Supabase.
// O app não tem dependências; instale o PGlite numa pasta temporária e aponte PGLITE_DIR para ela:
//   mkdir %TEMP%\pglite && cd %TEMP%\pglite && npm init -y && npm i @electric-sql/pglite@0.2.17
//   set PGLITE_DIR=%TEMP%\pglite   (PowerShell: $env:PGLITE_DIR="$env:TEMP\pglite")
//   node supabase/tests/run_local.mjs .
// Recria o mínimo do Supabase (roles anon/authenticated, auth.users, auth.uid(), privilégios padrão), aplica a migração,
// roda supabase/tests/001_cloud_sync_test.sql, prova que o teste apanha sabotagens e testa duas escritas concorrentes.
// Isto NÃO substitui rodar o teste no projeto Supabase real (ver README).
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_DIR ? pathToFileURL(path.join(process.env.PGLITE_DIR, 'node_modules/@electric-sql/pglite/dist/index.js')).href : '@electric-sql/pglite');
import fs from 'node:fs'; import path from 'node:path';
const raiz = path.resolve(process.argv[2]);
const MIG = fs.readFileSync(path.join(raiz, 'supabase/migrations/001_cloud_sync.sql'), 'utf8');
const TST = fs.readFileSync(path.join(raiz, 'supabase/tests/001_cloud_sync_test.sql'), 'utf8');

// Ambiente mínimo equivalente ao do Supabase para estes objetos.
const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Privilégios padrão do Supabase em objetos novos do schema public (a migração precisa revogá-los).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
-- Storage (Entrega 5): só as colunas usadas pelas políticas; no Supabase, storage.objects já vem com RLS ligado e
-- privilégios de tabela para anon/authenticated (quem decide o acesso são as políticas).
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated; grant select on storage.buckets to anon, authenticated;
`;
const MIG2 = fs.readFileSync(path.join(raiz, 'supabase/migrations/002_images_storage.sql'), 'utf8');
const TST2 = fs.readFileSync(path.join(raiz, 'supabase/tests/002_images_storage_test.sql'), 'utf8');

async function novo() { const db = new PGlite(); await db.exec(STUB); return db; }
async function rodar(nome, fn) { try { await fn(); console.log('✔', nome); return true; } catch (e) { console.log('✖', nome, '\n   ', e.message); return false; } }
let ok = true;

// 1) Migração + verificação completa.
ok &= await rodar('migração aplicada e todas as verificações de segurança/revisão passaram', async () => {
  const db = await novo(); const avisos = [];
  await db.exec(MIG);
  await db.query('select 1', [], {}); // sanidade
  const r = await db.exec(TST, { onNotice: n => avisos.push(n.message) });
  void r; if (avisos.length) avisos.forEach(a => console.log('    ·', a));
  // A transação de teste termina em ROLLBACK: nada pode ter ficado gravado.
  const n = (await db.query('select count(*)::int as n from public.sodual_user_data')).rows[0].n;
  const u = (await db.query('select count(*)::int as n from auth.users')).rows[0].n;
  if (n !== 0 || u !== 0) throw new Error(`rollback não limpou (linhas=${n}, usuários=${u})`);
});

// 2) Migração idempotente (rodar duas vezes não falha nem duplica).
ok &= await rodar('migração pode ser executada duas vezes', async () => { const db = await novo(); await db.exec(MIG); await db.exec(MIG); await db.exec(TST); });

// 3) Prova de que o teste detecta falhas reais: sabotagens precisam ser apanhadas.
const sabotagens = [
  ['UPDATE direto liberado ao cliente', 'grant update on public.sodual_user_data to authenticated;'],
  ['RLS desligado', 'alter table public.sodual_user_data disable row level security; grant select on public.sodual_user_data to anon;'],
  ['anon com acesso à escrita', 'grant execute on function public.sodual_sync_put(jsonb,bigint,integer,text) to anon;'],
  ['controle de revisão removido', `create or replace function public.sodual_sync_put(p_data jsonb,p_expected_revision bigint,p_schema_version integer,p_device text default null) returns jsonb language plpgsql security definer set search_path='' as $$
     declare v bigint; begin insert into public.sodual_user_data(user_id,data,schema_version) values (auth.uid(),p_data,p_schema_version)
     on conflict (user_id) do update set data=excluded.data, revision=public.sodual_user_data.revision+1 returning revision into v;
     return jsonb_build_object('ok',true,'revision',v); end $$;`],
];
for (const [nome, sql] of sabotagens) {
  ok &= await rodar('o teste detecta sabotagem: ' + nome, async () => {
    const db = await novo(); await db.exec(MIG); await db.exec(sql);
    let falhou = false; try { await db.exec(TST); } catch (e) { falhou = /FALHOU/.test(e.message); if (!falhou) throw e; }
    if (!falhou) throw new Error('o script de teste NÃO percebeu a sabotagem');
  });
}

// 4) Concorrência: duas "abas" com a mesma revisão esperada — só uma escrita pode vencer.
ok &= await rodar('duas escritas com a mesma revisão: uma vence, a outra recebe conflito', async () => {
  const db = await novo(); await db.exec(MIG);
  await db.exec(`insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000aa');`);
  const como = `set role authenticated; select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000aa"}',false);`;
  await db.exec(como);
  const put = async (rev, d) => (await db.query(`select public.sodual_sync_put($1::jsonb,$2,3,$3) as r`, [JSON.stringify({ chars: [], set: { nome: d } }), rev, d])).rows[0].r;
  const c = await put(0, 'pc'); if (c.revision != 1) throw new Error('criação');
  const pc = await put(1, 'computador'), cel = await put(1, 'celular');
  if (!pc.ok || cel.ok || !cel.conflict || cel.revision != 2) throw new Error(JSON.stringify({ pc, cel }));
  const linha = (await db.query('select data, revision, updated_by_device from public.sodual_user_data')).rows[0];
  if (linha.data.set.nome !== 'computador' || linha.revision != 2) throw new Error('o perdedor sobrescreveu: ' + JSON.stringify(linha));
});

// 5) Storage (migração 002): verificação completa, idempotência e sabotagens.
ok &= await rodar('002: bucket privado e políticas de imagens passaram', async () => {
  const db = await novo(); const avisos = [];
  await db.exec(MIG); await db.exec(MIG2); await db.exec(TST2, { onNotice: n => avisos.push(n.message) });
  if (!avisos.some(a => /TODAS AS VERIFICAÇÕES DO STORAGE PASSARAM/.test(a))) throw new Error('mensagem de sucesso ausente: ' + avisos.join(' | '));
  const n = (await db.query('select count(*)::int as n from storage.objects')).rows[0].n;
  if (n !== 0) throw new Error('rollback não limpou storage.objects');
});
ok &= await rodar('002: migração pode ser executada duas vezes e corrige bucket público', async () => {
  const db = await novo();
  await db.exec(`insert into storage.buckets (id, name, public) values ('sodual-images','sodual-images',true);`);
  await db.exec(MIG2); await db.exec(MIG2); await db.exec(TST2);
  const b = (await db.query(`select public, file_size_limit from storage.buckets where id='sodual-images'`)).rows[0];
  if (b.public !== false || +b.file_size_limit !== 1048576) throw new Error(JSON.stringify(b));
});
const sabot2 = [
  ['bucket público', `update storage.buckets set public = true where id = 'sodual-images';`],
  ['leitura sem checar a pasta', `drop policy "sodual_images_select_own" on storage.objects; create policy "sodual_images_select_own" on storage.objects for select to authenticated using (bucket_id = 'sodual-images');`],
  ['escrita em qualquer pasta', `create or replace function public.sodual_image_path_ok(p_name text) returns boolean language sql stable set search_path = '' as $$ select auth.uid() is not null $$;`],
  ['política extra liberando anon', `create policy "sodual_images_anon" on storage.objects for select to anon using (bucket_id = 'sodual-images');`],
  ['anon executa a função de caminho', `grant execute on function public.sodual_image_path_ok(text) to anon;`],
];
for (const [nome, sql] of sabot2) {
  ok &= await rodar('002: o teste detecta sabotagem: ' + nome, async () => {
    const db = await novo(); await db.exec(MIG2); await db.exec(sql);
    let falhou = false; try { await db.exec(TST2); } catch (e) { falhou = /FALHOU/.test(e.message); if (!falhou) throw e; }
    if (!falhou) throw new Error('o script de teste NÃO percebeu a sabotagem');
  });
}

console.log(ok ? '\nRESULTADO: tudo passou' : '\nRESULTADO: há falhas'); process.exit(ok ? 0 : 1);
