// Testes das imagens na nuvem (src/imagens-nuvem.js + syncCargaStr em src/sync.js) — node --test "tests/*.test.mjs"
// Storage falso com a mesma regra das políticas da migração 002: cada usuário só lê/grava em "<uid>/...".
// URLs assinadas expiram (token por geração) para testar a renovação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = ['rules.js', 'creation.js', 'sync.js', 'imagens-nuvem.js'].map(f => [f, fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')]);
const espera = ms => new Promise(r => setTimeout(r, ms));
async function ate(cond, ms = 2500) { const fim = Date.now() + ms; while (Date.now() < fim) { if (cond()) return true; await espera(5); } return false; }
const j = x => JSON.parse(JSON.stringify(x));
const img = (txt, tipo = 'image/jpeg') => `data:${tipo};base64,` + Buffer.from('IMG:' + txt + ':' + 'x'.repeat(3000)).toString('base64');

class Servidor {
  constructor() { this.linhas = new Map(); this.arquivos = new Map(); this.offline = false; this.stOff = false; this.rpcs = 0; this.uploads = 0; this.geracao = 1; this.downloads = 0; this.negados = 0; }
  async _rede(st) { await espera(1); if (this.offline || (st && this.stOff)) throw new TypeError('Failed to fetch'); }
  cliente(uid) {
    const s = this;
    const dono = p => typeof p === 'string' && p.startsWith(uid + '/');
    return {
      from() { return { select() { return { async maybeSingle() {
        try { await s._rede(); } catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
        const r = s.linhas.get(uid); return { data: r ? j(r) : null, error: null };
      } }; } }; },
      async rpc(nome, a) {
        try { await s._rede(); } catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
        s.rpcs++; const r = s.linhas.get(uid), agora = new Date(Date.now() + s.rpcs).toISOString();
        if (nome === 'sodual_sync_put') {
          if (a.p_expected_revision === 0) {
            if (r) return { data: { ok: false, conflict: true, revision: r.revision }, error: null };
            s.linhas.set(uid, { data: j(a.p_data), revision: 1, updated_at: agora }); return { data: { ok: true, revision: 1, updated_at: agora }, error: null };
          }
          if (!r || r.revision !== a.p_expected_revision) return { data: { ok: false, conflict: true, revision: r ? r.revision : 0 }, error: null };
          Object.assign(r, { data: j(a.p_data), revision: r.revision + 1, updated_at: agora }); return { data: { ok: true, revision: r.revision, updated_at: agora }, error: null };
        }
        return { data: null, error: { code: 'PGRST202', message: 'função inexistente' } };
      },
      storage: { from(b) {
        return {
          async upload(p, blob, o) {
            try { await s._rede(true); } catch (e) { return { data: null, error: { name: 'StorageUnknownError', message: e.message } }; }
            if (b !== 'sodual-images' || !dono(p)) { s.negados++; return { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } }; }
            if (s.arquivos.has(p) && !o.upsert) return { data: null, error: { message: 'The resource already exists', statusCode: '409' } };
            s.uploads++; s.arquivos.set(p, { bytes: Buffer.from(await blob.arrayBuffer()), type: o.contentType, criado: Date.now() }); return { data: { path: p }, error: null };
          },
          async list(pre, o) {
            try { await s._rede(true); } catch (e) { return { data: null, error: { name: 'StorageUnknownError', message: e.message } }; }
            if (!dono(pre + '/')) { s.negados++; return { data: [], error: null }; }       // RLS: pasta alheia aparece vazia
            const filhos = new Map();
            for (const [k, f] of s.arquivos) { if (!k.startsWith(pre + '/')) continue; const resto = k.slice(pre.length + 1), i = resto.indexOf('/');
              if (i < 0) filhos.set(resto, { name: resto, id: 'id-' + resto, created_at: new Date(f.criado).toISOString(), metadata: { size: f.bytes.length } });
              else filhos.set(resto.slice(0, i), { name: resto.slice(0, i), id: null }); }
            const l = [...filhos.values()].sort((a, b) => a.name < b.name ? -1 : 1); return { data: l.slice(o.offset || 0, (o.offset || 0) + (o.limit || 100)), error: null };
          },
          async remove(ps) {
            try { await s._rede(true); } catch (e) { return { data: null, error: { name: 'StorageUnknownError', message: e.message } }; }
            const ok = ps.filter(p => dono(p) && s.arquivos.has(p)); if (ps.some(p => !dono(p))) s.negados++;
            ok.forEach(p => s.arquivos.delete(p)); s.removidos = (s.removidos || 0) + ok.length; return { data: ok.map(name => ({ name })), error: null };
          },
          async createSignedUrl(p, seg) {
            try { await s._rede(true); } catch (e) { return { data: null, error: { name: 'StorageUnknownError', message: e.message } }; }
            if (!dono(p)) { s.negados++; return { data: null, error: { message: 'Object not found', statusCode: '404' } }; }
            if (!s.arquivos.has(p)) return { data: null, error: { message: 'Object not found', statusCode: '404' } };
            return { data: { signedUrl: `https://fake.storage/sign/${encodeURIComponent(p)}?g=${s.geracao}&exp=${seg}` }, error: null };
          },
        };
      } },
    };
  }
  /* fetch das URLs assinadas: só vale a geração atual (as antigas "expiram"). */
  fetch() {
    const s = this;
    return async url => {
      await s._rede(true);
      const u = new URL(url), p = decodeURIComponent(u.pathname.replace('/sign/', '')), f = s.arquivos.get(p);
      if (+u.searchParams.get('g') !== s.geracao) return { ok: false, status: 400 };
      if (!f) return { ok: false, status: 404 };
      s.downloads++; return { ok: true, status: 200, blob: async () => new Blob([f.bytes], { type: f.type }) };
    };
  }
}

function dispositivo(srv, armazenado = {}) {
  const mem = { ...armazenado };
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const document = { getElementById: () => null, querySelector: () => null };
  const ctx = vm.createContext({ localStorage, document, console, setTimeout, clearTimeout, Date, JSON, Math, Blob, atob, btoa, crypto: globalThis.crypto, fetch: srv.fetch(), URL });
  for (const [f, s] of SRC) vm.runInContext(s, ctx, { filename: f });
  vm.runInContext('SYNC_CFG.debounce=10;SYNC_CFG.backoff=[30,60];SYNC_CFG.maxTentativas=3;IMGN_CFG.espera=10;IMGN_CFG.backoff=[40,80];IMGN_CFG.maxTent=2', ctx);
  const run = e => vm.runInContext(e, ctx);
  return {
    mem, run,
    async entrar(uid) { ctx.__cli = srv.cliente(uid); run(`loadS("sodual.v1.u.${uid}")`); return run(`syncIniciar({id:"${uid}"},{cliente:__cli})`); },
    get estado() { return run('SY.estado'); },
    get S() { return j(run('S')); },
    st() { return j(run('imgnStatus()')); },
  };
}
const U = '11111111-1111-4111-8111-111111111111', V = '22222222-2222-4222-8222-222222222222';
const A1 = img('avatar'), A1S = img('avatar-original'), R1 = img('retrato'), R1S = img('retrato-original'), P1 = img('amigo');
const comImagens = uid => ({ [`sodual.v1.u.${uid}`]: JSON.stringify({ v: 3,
  chars: [{ id: 'c1', nome: 'Lia', a: {}, w: {}, mana: 7, manaMax: 13, nucleo: 'Vermelho Escuro', img: R1, imgSrc: R1S, imgCrop: { x: .4, y: .5, z: 1.5 } }],
  net: { pos: {}, edges: [], people: [{ id: 'p1', nome: 'Amigo', cor: '#fff', img: P1 }] },
  set: { nome: 'Jogador', img: A1, imgSrc: A1S, imgCrop: { x: .5, y: .5, z: 2 } } }) });
const tudoNaNuvem = d => d.st().enviar === 0 && d.estado === 'salvo';

/* ======================================================================================== */
test('17. upload: imagens antigas em base64 vão para o Storage privado; o JSON da nuvem passa a levar só a referência', async () => {
  const srv = new Servidor(), d = dispositivo(srv, comImagens(U));
  assert.equal(await d.entrar(U), 'migrar');
  await espera(40); assert.equal(srv.uploads, 0, 'nada é enviado antes de o jogador aceitar a migração');
  d.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef), 'imagens enviadas e JSON atualizado');
  assert.equal(srv.uploads, 5);                                                   // avatar + original, retrato + original, amigo
  for (const p of srv.arquivos.keys()) assert.match(p, new RegExp(`^${U}/(profile/avatar|characters/c1|network/p1)/[0-9a-f]{40}\\.jpg$`));
  const nv = srv.linhas.get(U).data;
  assert.equal(nv.set.img, ''); assert.equal(nv.set.imgSrc, ''); assert.equal(nv.chars[0].img, ''); assert.equal(nv.net.people[0].img, '');
  assert.ok(nv.set.imgRef.p.startsWith(U + '/profile/avatar/')); assert.ok(nv.chars[0].imgSrcRef.p.startsWith(U + '/characters/c1/'));
  assert.ok(!JSON.stringify(nv).includes('base64'), 'nenhum base64 no Postgres depois da migração');
  assert.ok(!JSON.stringify(nv).includes('https://'), 'nunca grava URL assinada');
  assert.deepEqual(nv.chars[0].imgCrop, { x: .4, y: .5, z: 1.5 }, 'enquadramento preservado');
  const S = d.S; assert.equal(S.set.img, A1); assert.equal(S.chars[0].imgSrc, R1S); assert.equal(S.net.people[0].img, P1); // cache local intacto
  assert.equal(d.run('syncStatus().pendente'), false);
});

test('18. falha no upload: imagem local preservada, base64 continua no JSON, pendência visível e nova tentativa', async () => {
  const srv = new Servidor(), d = dispositivo(srv, comImagens(U));
  srv.stOff = true;                                                               // banco responde, Storage não
  await d.entrar(U); d.run('syncMigrar()');
  assert.ok(await ate(() => d.estado === 'salvo' && d.st().erro));
  const nv = srv.linhas.get(U).data;
  assert.equal(nv.set.img, A1, 'sem confirmação do upload, a nuvem guarda o base64 (nunca uma referência inválida)');
  assert.equal(nv.set.imgRef, undefined);
  assert.equal(d.S.set.img, A1); assert.equal(d.st().enviar, 5); assert.match(d.st().erro, /Sem conexão/);
  srv.stOff = false; d.run('imgnAgora()');
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef));
  assert.equal(d.st().erro, '');
});

test('19. recuperação: outro dispositivo baixa por URL assinada, confere e guarda localmente sem gerar pendência', async () => {
  const srv = new Servidor(), a = dispositivo(srv, comImagens(U));
  await a.entrar(U); a.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(a) && srv.linhas.get(U).data.set.imgRef));
  const rpcs = srv.rpcs, b = dispositivo(srv);
  assert.equal(await b.entrar(U), 'adotar');
  assert.ok(await ate(() => b.S.set.img === A1 && b.S.chars[0].img === R1 && b.S.chars[0].imgSrc === R1S && b.S.net.people[0].img === P1), 'imagens baixadas');
  assert.equal(b.estado, 'salvo'); assert.equal(b.run('syncStatus().pendente'), false);
  await espera(40); assert.equal(srv.rpcs, rpcs, 'baixar imagens não reenvia o JSON');
  assert.equal(JSON.parse(b.mem[`sodual.v1.u.${U}`]).set.img, A1, 'cache gravado no localStorage');
  assert.deepEqual(b.S.chars[0].imgCrop, { x: .4, y: .5, z: 1.5 });
});

test('URL assinada expirada é renovada; arquivo ausente não trava a fila', async () => {
  const srv = new Servidor(), a = dispositivo(srv, comImagens(U));
  await a.entrar(U); a.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(a) && !JSON.stringify(srv.linhas.get(U).data).includes('base64') && a.run('IMGN.vist.size') === 5)); a.run('syncEncerrar()');
  const b = dispositivo(srv);
  b.run(`IMGN_CFG.espera=100000`);                                                // segura a rodada automática
  await b.entrar(U);
  b.run(`imgnSessao();IMGN.urls.set(S.set.imgRef.p,{u:"https://fake.storage/sign/${encodeURIComponent('x')}?g=0",exp:Date.now()+3600000})`);
  srv.arquivos.delete(srv.linhas.get(U).data.net.people[0].imgRef.p);            // um arquivo some do Storage
  await b.run('imgnAgora()');
  assert.equal(b.S.set.img, A1, 'renovou a URL vencida e baixou');
  assert.equal(b.S.net.people[0].img, '', 'arquivo ausente: fica sem imagem, sem inventar conteúdo');
  assert.equal(b.st().baixar, 0); assert.equal(b.st().ignoradas, 1);
  b.run('syncEncerrar()'); assert.equal(b.run('IMGN.timer'), null, 'logout cancela as tarefas de imagem');
});

test('imagem trocada depois do envio: a referência antiga é ignorada e o novo conteúdo segue (base64 → Storage)', async () => {
  const srv = new Servidor(), d = dispositivo(srv, comImagens(U));
  await d.entrar(U); d.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef));
  const antigo = srv.linhas.get(U).data.set.imgRef.p, A2 = img('avatar-novo');
  srv.stOff = true; d.run(`S.set.img=${JSON.stringify(A2)};save()`);
  assert.ok(await ate(() => d.estado === 'salvo' && srv.linhas.get(U).data.set.img === A2), 'sem upload, vai o base64 novo');
  assert.equal(srv.linhas.get(U).data.set.imgRef, undefined, 'nunca a referência da imagem antiga');
  srv.stOff = false; d.run('imgnAgora()');
  assert.ok(await ate(() => tudoNaNuvem(d) && (srv.linhas.get(U).data.set.imgRef || {}).p && srv.linhas.get(U).data.set.imgRef.p !== antigo));
  assert.equal(srv.linhas.get(U).data.set.img, '');
});

test('isolamento: referência de outra conta (backup restaurado) não vale; nada é lido nem gravado fora da própria pasta', async () => {
  const srv = new Servidor(), a = dispositivo(srv, comImagens(U));
  await a.entrar(U); a.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(a) && srv.linhas.get(U).data.set.imgRef));
  const alheio = j(srv.linhas.get(U).data);                                       // JSON de U (só referências) cai na conta V
  const b = dispositivo(srv, { [`sodual.v1.u.${V}`]: JSON.stringify(alheio) });
  assert.equal(await b.entrar(V), 'migrar'); b.run('syncMigrar()');
  assert.ok(await ate(() => b.estado === 'salvo'));
  await espera(60);
  const nv = srv.linhas.get(V).data;
  assert.equal(nv.set.imgRef, undefined, 'referência alheia descartada no envio');
  assert.equal(srv.negados, 0, 'nem tentou acessar arquivos de outra conta');
  assert.equal(b.st().baixar, 0);
  for (const p of srv.arquivos.keys()) assert.ok(p.startsWith(U + '/'));
});

test('backup portátil: imagens em base64 (do cache ou baixadas agora) e sem caminhos privados', async () => {
  const srv = new Servidor(), a = dispositivo(srv, comImagens(U));
  await a.entrar(U); a.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(a) && srv.linhas.get(U).data.set.imgRef));
  const b = dispositivo(srv); b.run('IMGN_CFG.espera=100000'); await b.entrar(U);
  assert.equal(b.S.set.img, '', 'ainda não baixado');
  const r = j(await b.run('imgExportavel(S)'));
  assert.equal(r.faltando, 0); assert.equal(r.dados.set.img, A1); assert.equal(r.dados.chars[0].imgSrc, R1S); assert.equal(r.dados.net.people[0].img, P1);
  assert.ok(!/Ref"/.test(JSON.stringify(r.dados)), 'sem referências privadas');
  srv.stOff = true;
  const r2 = j(await b.run('imgExportavel(syncLerCopia(".antes-nuvem")?syncLerCopia(".antes-nuvem").dados:S)'));
  assert.ok(r2.faltando > 0, 'sem conexão: informa quantas imagens ficaram de fora');
  b.run('syncEncerrar()');
});

test('formato não aceito (SVG) não é enviado ao Storage nem vira referência; data URL válido acima de 1 MB fica só no JSON', async () => {
  const GRANDE = 'data:image/jpeg;base64,' + Buffer.alloc(1100000, 7).toString('base64');
  const srv = new Servidor(), svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64');
  const d = dispositivo(srv, { [`sodual.v1.u.${U}`]: JSON.stringify({ v: 3, chars: [{ id: 'c1', nome: 'Lia', a: {}, w: {}, img: svg }], net: { pos: {}, edges: [], people: [{ id: 'p1', nome: 'X', cor: '#ffffff', img: GRANDE }] }, set: { nome: 'J' } }) });
  await d.entrar(U); d.run('syncMigrar()');
  assert.ok(await ate(() => d.estado === 'salvo')); await espera(60);
  assert.equal(srv.uploads, 0); assert.equal(srv.linhas.get(U).data.chars[0].img, '', 'SVG (nunca gerado pelo app) é descartado na normalização e não vai a lugar nenhum');
  assert.equal(srv.linhas.get(U).data.net.people[0].img, GRANDE, 'acima de 1 MB: fica no JSON, nunca vira referência'); assert.equal(d.st().enviar, 0); assert.equal(d.st().ignoradas, 1);
});

test('troca de conta durante o envio: a resposta atrasada não grava referência na conta nova', async () => {
  const srv = new Servidor(), d = dispositivo(srv, Object.assign(comImagens(U), { [`sodual.v1.u.${V}`]: JSON.stringify({ v: 3, chars: [], net: { pos: {}, edges: [], people: [] }, set: { nome: 'V' } }) }));
  await d.entrar(U); d.run('syncMigrar()');
  assert.ok(await ate(() => d.run('IMGN.rodando')));
  d.run('syncEncerrar()'); await d.entrar(V);
  await espera(80);
  assert.ok(!JSON.stringify(d.S).includes('Ref'), 'nenhuma referência de U entrou na conta V');
  assert.ok(!d.mem[`sodual.v1.u.${V}`].includes(U));
});

/* ======================================================================================== limpeza segura */
const DIA = 864e5;
async function contaPronta(srv) { const d = dispositivo(srv, comImagens(U)); await d.entrar(U); d.run('syncMigrar()');
  assert.ok(await ate(() => tudoNaNuvem(d) && !JSON.stringify(srv.linhas.get(U).data).includes('base64') && d.run('IMGN.vist.size') === 5)); return d; }
const envelhecer = (srv, dias) => { for (const f of srv.arquivos.values()) f.criado -= dias * DIA; };

test('limpeza: remove só imagens antigas sem uso; mantém as em uso, as recentes e as de cópias guardadas', async () => {
  const srv = new Servidor(), d = await contaPronta(srv);
  const A2 = img('avatar-2'), A3 = img('avatar-3');
  d.run(`S.set.img=${JSON.stringify(A2)};save()`);                         // A1 vira órfã
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef && srv.arquivos.size === 6));
  const p2 = srv.linhas.get(U).data.set.imgRef.p;
  envelhecer(srv, 40);                                                      // tudo com 40 dias
  d.run(`S.set.img=${JSON.stringify(A3)};save()`);                          // A2 vira órfã; A3 é recente
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef.p !== p2 && srv.arquivos.size === 7));
  // uma cópia guardada ainda usa A1 → não pode sumir
  const a1 = [...srv.arquivos.keys()].find(k => k.includes('/profile/avatar/') && srv.arquivos.get(k).bytes.toString().includes('IMG:avatar:'));
  d.run(`localStorage.setItem(LS+'.antes-nuvem',JSON.stringify({salvo:'x',dados:{chars:[],set:{img:'',imgRef:{p:${JSON.stringify(a1)},h:'x'}}}}))`);
  const an = j(await d.run('imgnAnaliseLimpeza()'));
  assert.equal(an.ok, true); assert.equal(an.total, 7);
  assert.deepEqual(an.orfaos.map(x => x.p), [p2], 'só A2: antiga e sem uso');
  assert.equal(an.recentes, 0, 'A3 está em uso; nenhuma órfã recente');
  const r = j(await d.run(`imgnLimpar(${JSON.stringify(an.orfaos)})`));
  assert.equal(r.ok, true); assert.equal(r.removidos, 1);
  assert.ok(!srv.arquivos.has(p2)); assert.ok(srv.arquivos.has(a1)); assert.equal(srv.arquivos.size, 6);
  assert.equal(srv.negados, 0);
});

test('limpeza: órfã recente (menos de 30 dias) fica; recusa com pendência, conflito ou nuvem mais nova', async () => {
  const srv = new Servidor(), d = await contaPronta(srv);
  d.run(`S.set.img=${JSON.stringify(img('novo'))};save()`);
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.arquivos.size === 6));
  let an = j(await d.run('imgnAnaliseLimpeza()'));
  assert.equal(an.orfaos.length, 0); assert.equal(an.recentes, 1);
  srv.offline = true; d.run(`S.chars[0].mana=1;save()`);
  assert.ok(await ate(() => d.estado === 'offline'));
  assert.equal(j(await d.run('imgnAnaliseLimpeza()')).motivo, 'pendente');
  srv.offline = false; d.run('syncAgora()'); assert.ok(await ate(() => d.estado === 'salvo'));
  srv.linhas.get(U).revision += 1;                                          // outro dispositivo gravou
  assert.equal(j(await d.run('imgnAnaliseLimpeza()')).motivo, 'desatualizado');
});

test('limpeza: lista confirmada é reconferida na hora; arquivo que voltou a ser usado não é apagado', async () => {
  const srv = new Servidor(), d = await contaPronta(srv);
  d.run(`S.set.img=${JSON.stringify(img('outra'))};save()`);
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.arquivos.size === 6));
  envelhecer(srv, 40);
  const an = j(await d.run('imgnAnaliseLimpeza()')); assert.equal(an.orfaos.length, 1);
  d.run(`S.set.img=${JSON.stringify(A1)};save()`);                          // o jogador volta à foto antiga antes de confirmar
  assert.ok(await ate(() => tudoNaNuvem(d) && srv.linhas.get(U).data.set.imgRef.p === an.orfaos[0].p));
  const r = j(await d.run(`imgnLimpar(${JSON.stringify(an.orfaos)})`));
  assert.equal(r.removidos, 0); assert.ok(srv.arquivos.has(an.orfaos[0].p));
  assert.equal(j(await d.run(`imgnLimpar([${JSON.stringify(V + '/profile/avatar/x.jpg')}])`)).removidos, 0, 'nunca fora da própria pasta');
});

test('autocorreção: dispositivo desatualizado com referência para arquivo removido reenvia a imagem que tem', async () => {
  const srv = new Servidor(), a = await contaPronta(srv);
  a.run('syncEncerrar()');
  const b = dispositivo(srv, j(a.mem)); b.run('IMGN_CFG.espera=10');
  const p = srv.linhas.get(U).data.chars[0].imgRef.p;
  srv.arquivos.delete(p);                                                   // removido por uma limpeza
  await b.entrar(U);
  assert.ok(await ate(() => srv.arquivos.has(p) && b.estado === 'salvo' && b.run('IMGN.vist.size') >= 5), 'mesmo conteúdo, mesmo caminho');
  assert.equal(b.S.chars[0].imgRef.p, p); assert.equal(b.S.chars[0].img, R1);
  const c = dispositivo(srv); await c.entrar(U);
  assert.ok(await ate(() => c.S.chars[0].img === R1), 'outros dispositivos voltam a receber a imagem');
});