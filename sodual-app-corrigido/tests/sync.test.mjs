// Testes da sincronização (src/sync.js) — execute com:  node --test "tests/*.test.mjs"
// Cada "dispositivo" é um contexto vm isolado (localStorage próprio) que carrega rules.js, creation.js e sync.js.
// O servidor falso reproduz a semântica da RPC sodual_sync_put/sodual_sync_delete (validada contra Postgres em supabase/tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = ['rules.js', 'creation.js', 'sync.js'].map(f => [f, fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')]);
const espera = ms => new Promise(r => setTimeout(r, ms));
async function ate(cond, ms = 1500) { const fim = Date.now() + ms; while (Date.now() < fim) { if (cond()) return true; await espera(5); } return false; }
const j = x => JSON.parse(JSON.stringify(x));

/* ---------- Servidor falso (mesma regra de revisão da migração 001) ---------- */
class Servidor {
  constructor() { this.linhas = new Map(); this.offline = false; this.atraso = 0; this.rpcs = 0; this.selects = 0; }
  async _rede() { if (this.atraso) await espera(this.atraso); if (this.offline) { const e = new TypeError('Failed to fetch'); throw e; } }
  cliente(uid) {
    const s = this;
    return {
      from() { return { select() { return { async maybeSingle() {
        try { await s._rede(); } catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
        s.selects++; const r = s.linhas.get(uid); return { data: r ? j(r) : null, error: null };
      } }; } }; },
      async rpc(nome, a) {
        try { await s._rede(); } catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
        s.rpcs++; const r = s.linhas.get(uid), agora = new Date(Date.now() + s.rpcs).toISOString();
        if (nome === 'sodual_sync_put') {
          if (!a.p_data || !Array.isArray(a.p_data.chars)) return { data: null, error: { code: '22023', message: 'payload' } };
          if (a.p_expected_revision === 0) {
            if (r) return { data: { ok: false, conflict: true, revision: r.revision, updated_at: r.updated_at }, error: null };
            s.linhas.set(uid, { data: j(a.p_data), revision: 1, updated_at: agora, updated_by_device: a.p_device });
            return { data: { ok: true, revision: 1, updated_at: agora }, error: null };
          }
          if (!r || r.revision !== a.p_expected_revision) return { data: { ok: false, conflict: true, revision: r ? r.revision : 0, updated_at: r && r.updated_at }, error: null };
          Object.assign(r, { data: j(a.p_data), revision: r.revision + 1, updated_at: agora, updated_by_device: a.p_device });
          return { data: { ok: true, revision: r.revision, updated_at: agora }, error: null };
        }
        if (nome === 'sodual_sync_delete') { if (r && r.revision === a.p_expected_revision) { s.linhas.delete(uid); return { data: { ok: true }, error: null }; } return { data: { ok: false, conflict: !!r, revision: r ? r.revision : 0 }, error: null }; }
        return { data: null, error: { code: 'PGRST202', message: 'função inexistente' } };
      },
    };
  }
}

/* ---------- Dispositivo ---------- */
function dispositivo(armazenado = {}) {
  const mem = { ...armazenado };
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const document = { getElementById: () => null, querySelector: () => null };
  const ctx = vm.createContext({ localStorage, document, console, setTimeout, clearTimeout, Date, JSON, Math });
  for (const [f, s] of SRC) vm.runInContext(s, ctx, { filename: f });
  vm.runInContext('SYNC_CFG.debounce=15;SYNC_CFG.backoff=[30,60];SYNC_CFG.maxTentativas=3', ctx);
  const run = e => vm.runInContext(e, ctx);
  return {
    mem, ctx, run,
    /* "Login": carrega o cache local da conta e inicia a sincronização com o cliente do usuário. */
    async entrar(srv, uid) { ctx.__cli = srv.cliente(uid); run(`loadS("sodual.v1.u.${uid}")`); return run(`syncIniciar({id:"${uid}"},{cliente:__cli})`); },
    get estado() { return run('SY.estado'); },
    get S() { return j(run('S')); },
    meta() { return j(run('SY.meta')); },
  };
}
/* Ficha válida (rolagem determinística) para não depender do acaso. */
function criarFicha(d, nome = 'Lia') {
  d.run(`(()=>{const w=newW();Object.assign(w,{nome:${JSON.stringify(nome)},idade:18,povo:'Arveni',origem:'Camponês',hab:'Leitura Social',per:['Atletismo','Natureza']});w.a={for:2,des:2,cor:2,car:1,int:2};rolarMana(w,()=>3);manterMana(w);S.chars=[mk(w)];save()})()`);
}
const dadosLocais = (uid, extra) => ({ [`sodual.v1.u.${uid}`]: JSON.stringify(Object.assign({ v: 3, chars: [{ id: 'c1', nome: 'Antiga', a: {}, w: {}, mana: 7, manaMax: 13, nucleo: 'Vermelho Escuro' }], net: { pos: {}, edges: [], people: [{ id: 'p1', nome: 'Amigo' }] }, set: { nome: 'Jogador' } }, extra || {})) });
const U = 'u-aaaa', V = 'u-bbbb';

/* ======================================================================================== */
test('1. conta nova sem dados: nada vai para a nuvem até existir conteúdo; depois cria a revisão 1', async () => {
  const srv = new Servidor(), d = dispositivo();
  assert.equal(await d.entrar(srv, U), 'vazio');
  d.run('S.set.col=1;save()');                                   // preferência sozinha não é "conteúdo"
  await espera(60); assert.equal(srv.rpcs, 0); assert.equal(d.estado, 'vazio');
  criarFicha(d);
  assert.ok(await ate(() => d.estado === 'salvo'));
  assert.equal(srv.linhas.get(U).revision, 1); assert.equal(srv.linhas.get(U).data.chars[0].nome, 'Lia');
});

test('2/4. dados locais + nuvem vazia: pergunta (migrar), nada sobe sem confirmação; migração só é marcada após o servidor confirmar', async () => {
  const srv = new Servidor(), d = dispositivo(dadosLocais(U));
  assert.equal(await d.entrar(srv, U), 'migrar');
  d.run('S.chars[0].mana=6;save()'); await espera(60);
  assert.equal(srv.rpcs, 0); assert.equal(srv.linhas.size, 0);
  srv.offline = true; d.run('syncMigrar()');
  assert.ok(await ate(() => d.estado === 'offline'));
  assert.equal(d.meta().rev, 0, 'sem confirmação do servidor, a migração não pode constar como feita');
  srv.offline = false; d.run('syncAgora()');
  assert.ok(await ate(() => d.estado === 'migrar'), 'refaz a decisão e volta a pedir confirmação (nada enviado automaticamente)');
  d.run('syncMigrar()');
  assert.ok(await ate(() => d.estado === 'salvo'));
  assert.equal(d.meta().rev, 1); assert.equal(srv.linhas.get(U).data.chars[0].mana, 6);
  assert.equal(srv.linhas.get(U).data.chars[0].id, 'c1');           // ids preservados
});

test('3. dados na nuvem + dispositivo vazio: carrega da nuvem e não envia nada', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a, 'Nuvem'); await ate(() => a.estado === 'salvo');
  const rpcs = srv.rpcs, b = dispositivo();
  assert.equal(await b.entrar(srv, U), 'adotar');
  assert.equal(b.S.chars[0].nome, 'Nuvem'); assert.equal(b.estado, 'salvo'); assert.equal(srv.rpcs, rpcs);
});

test('5. dados iguais: nenhuma escrita extra', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a); await ate(() => a.estado === 'salvo');
  const copia = { ...a.mem }; delete copia[`sodual.v1.u.${U}.sync`];  // outro aparelho com o mesmo conteúdo, sem metadados
  const rpcs = srv.rpcs, b = dispositivo(copia);
  assert.equal(await b.entrar(srv, U), 'igual'); assert.equal(srv.rpcs, rpcs); assert.equal(b.meta().rev, 1);
});

test('6. dados divergentes sem histórico comum: conflito, nada é sobrescrito em nenhum lado', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a, 'Da nuvem'); await ate(() => a.estado === 'salvo');
  const b = dispositivo(dadosLocais(U));
  assert.equal(await b.entrar(srv, U), 'conflito');
  b.run('S.chars[0].mana=1;save()'); await espera(60);
  assert.equal(srv.linhas.get(U).data.chars[0].nome, 'Da nuvem'); assert.equal(srv.linhas.get(U).revision, 1);
  assert.equal(b.S.chars[0].nome, 'Antiga'); assert.equal(b.S.chars[0].mana, 1);
  assert.ok(b.run('SY.conflito.remoto.revision') === 1);
});

test('7/8. dois dispositivos: o segundo a salvar recebe conflito; o trabalho do primeiro não é apagado', async () => {
  const srv = new Servidor(), pc = dispositivo(); await pc.entrar(srv, U); criarFicha(pc); await ate(() => pc.estado === 'salvo');
  const cel = dispositivo(); await cel.entrar(srv, U); assert.equal(cel.S.chars[0].nome, 'Lia');
  pc.run('S.chars[0].mana=2;save()'); await ate(() => pc.estado === 'salvo' && srv.linhas.get(U).revision === 2);
  cel.run('S.chars[0].bag.push({id:"x",nome:"Corda",qtd:1,cat:"Item comum"});save()');
  assert.ok(await ate(() => cel.estado === 'conflito'));
  assert.equal(srv.linhas.get(U).data.chars[0].mana, 2, 'a mana do computador continua na nuvem');
  assert.equal(srv.linhas.get(U).data.chars[0].bag.length, 0);
  assert.equal(cel.S.chars[0].bag[0].nome, 'Corda', 'a mudança do celular continua no celular');
});

test('9/10. falha de conexão: fica pendente neste dispositivo, sem perder nada; ao reconectar envia e confirma', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  srv.offline = true;
  d.run('S.chars[0].mana=4;save()'); assert.ok(await ate(() => d.estado === 'offline'));
  for (let i = 0; i < 5; i++) d.run('S.chars[0].mana--;save()');   // edições offline não disparam requisições a cada mudança
  assert.equal(JSON.parse(d.mem[`sodual.v1.u.${U}`]).chars[0].mana, -1, 'tudo gravado localmente');
  assert.equal(d.run('syncStatus().pendente'), true);
  srv.offline = false; d.run('syncAgora()');
  assert.ok(await ate(() => d.estado === 'salvo'));
  assert.equal(srv.linhas.get(U).data.chars[0].mana, -1); assert.equal(d.run('syncStatus().pendente'), false);
});

test('debounce: várias edições seguidas viram uma única escrita; edição durante o envio gera outro envio depois', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  const antes = srv.rpcs; for (let i = 0; i < 20; i++) d.run(`S.chars[0].notes="${'x'.repeat(i)}";save()`);
  assert.ok(await ate(() => d.estado === 'salvo')); assert.equal(srv.rpcs - antes, 1);
  srv.atraso = 40; d.run('S.chars[0].mana=4;save()');
  assert.ok(await ate(() => d.estado === 'salvando'));
  d.run('S.chars[0].mana=5;save()');                                 // muda enquanto o envio anterior está em andamento
  assert.ok(await ate(() => d.estado === 'salvo' && srv.linhas.get(U).data.chars[0].mana === 5, 2000));
  assert.equal(d.meta().rev, srv.linhas.get(U).revision);
});

test('o estado padrão nunca é enviado antes de conhecer a nuvem', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a, 'Importante'); await ate(() => a.estado === 'salvo');
  srv.atraso = 60; const b = dispositivo(), p = b.entrar(srv, U);
  b.run('save();save()');                                            // gravações durante "iniciando"
  await espera(20); assert.equal(b.estado, 'iniciando'); const rpcs = srv.rpcs;
  await p; assert.equal(srv.rpcs, rpcs); assert.equal(srv.linhas.get(U).data.chars[0].nome, 'Importante');
});

test('11. logout com pendência: nada é perdido; no próximo login desta conta o pendente é enviado', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  d.run('S.chars[0].mana=3;save();syncEncerrar()'); await espera(60);
  assert.equal(srv.linhas.get(U).revision, 1, 'sessão encerrada não envia');
  assert.equal(JSON.parse(d.mem[`sodual.v1.u.${U}`]).chars[0].mana, 3);
  const d2 = dispositivo(d.mem);                                     // reabre o mesmo navegador
  assert.equal(await d2.entrar(srv, U), 'enviar'); assert.ok(await ate(() => d2.estado === 'salvo'));
  assert.equal(srv.linhas.get(U).data.chars[0].mana, 3);
});

test('12/13. troca de conta: resposta atrasada da conta anterior nunca altera a nova conta', async () => {
  const srv = new Servidor();
  const a = dispositivo(); await a.entrar(srv, U); criarFicha(a, 'De A'); await ate(() => a.estado === 'salvo');
  const b = dispositivo(); await b.entrar(srv, V); criarFicha(b, 'De B'); await ate(() => b.estado === 'salvo');
  // Mesmo navegador: começa a carregar A (lento), mas o jogador troca para B antes da resposta.
  const d = dispositivo(); srv.atraso = 50;
  const pA = d.entrar(srv, U);
  d.run('syncEncerrar()'); srv.atraso = 0;                          // logout/troca: o Gate encerra a sessão de sincronização
  const pB = d.entrar(srv, V);
  assert.equal(await pB, 'adotar'); assert.equal(await pA, 'descartado');
  await espera(80);
  assert.equal(d.S.chars[0].nome, 'De B'); assert.equal(d.run('LS'), `sodual.v1.u.${V}`);
  assert.equal(d.mem[`sodual.v1.u.${U}`], undefined, 'nada da conta A foi gravado neste navegador');
  assert.equal(srv.linhas.get(U).data.chars[0].nome, 'De A');
});

test('14. restauração de backup: envia com controle de revisão; se a nuvem mudou, vira conflito', async () => {
  const srv = new Servidor(), pc = dispositivo(); await pc.entrar(srv, U); criarFicha(pc); await ate(() => pc.estado === 'salvo');
  const backup = JSON.parse(pc.mem[`sodual.v1.u.${U}`]); backup.chars[0].nome = 'Do backup';
  pc.ctx.__bk = backup; pc.run('S=norm(__bk);save()');
  assert.ok(await ate(() => pc.estado === 'salvo')); assert.equal(srv.linhas.get(U).data.chars[0].nome, 'Do backup');
  const cel = dispositivo(); await cel.entrar(srv, U);
  pc.run('S.chars[0].mana=1;save()'); await ate(() => srv.linhas.get(U).revision === 3);
  cel.ctx.__bk = backup; cel.run('S=norm(__bk);S.chars[0].nome="Backup antigo";save()');
  assert.ok(await ate(() => cel.estado === 'conflito')); assert.equal(srv.linhas.get(U).data.chars[0].mana, 1);
});

test('15. limpar este dispositivo: os dados voltam da nuvem; o vazio não é enviado', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  d.run('syncEncerrar()'); for (const k of ['', '.sync', '.bak', '.prev']) delete d.mem[`sodual.v1.u.${U}${k}`];
  const d2 = dispositivo(d.mem); assert.equal(await d2.entrar(srv, U), 'adotar');
  assert.equal(d2.S.chars[0].nome, 'Lia'); assert.equal(srv.linhas.get(U).revision, 1);
});

test('16. dados removidos da nuvem por outro dispositivo: não são recriados silenciosamente', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  srv.linhas.delete(U);
  d.run('S.chars[0].mana=9;save()'); assert.ok(await ate(() => d.estado === 'conflito'));
  assert.equal(d.run('SY.conflito.tipo'), 'remoto-apagado'); assert.equal(srv.linhas.size, 0);
  const d2 = dispositivo(d.mem); assert.equal(await d2.entrar(srv, U), 'remoto-apagado');
});

test('20–25. ida e volta preserva rascunho, histórico de combate, ferimentos, amputação, mana, núcleo, perfil e rede', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a);
  a.run(`const c=S.chars[0];c.mana=5;c.nucleo='Amarelo Claro';wound(c,'tronco',2);wound(c,'be',5);wound(c,'be',1,()=>4);wound(c,'cabeca',1);
    S.set.perfil=normPerfil({titulo:'Desbravador',bio:'Oi',moldura:'runas-douradas',banner:'dragao-violeta',insignias:['explorador']});
    S.net.people.push({id:'p9',nome:'Mestre',cor:'#fff',img:''});S.net.edges.push({id:'e1',a:c.id,b:'p9',tipo:'Aliado'});S.net.pos.p9={x:10,y:20};
    S.wiz=newW();S.wiz.nome='Rascunho';save()`);
  assert.ok(await ate(() => a.estado === 'salvo'));
  const b = dispositivo(); await b.entrar(srv, U);
  const x = a.S, y = b.S;
  assert.deepEqual(y.chars, x.chars); assert.deepEqual(y.set.perfil, x.set.perfil); assert.deepEqual(y.net, x.net); assert.deepEqual(y.wiz, x.wiz);
  const c = y.chars[0];
  assert.equal(c.w.be.amp, 1); assert.equal(c.w.tronco.g, 2); assert.equal(c.mana, 5); assert.equal(c.nucleo, 'Amarelo Claro');
  assert.ok(c.cb.length >= 4); assert.equal(c.mana0.dados, '3D4');
});

test('payload: só dados do app (sem credenciais) e acima do limite não é enviado', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  const chaves = Object.keys(srv.linhas.get(U).data).sort();
  assert.deepEqual(chaves, ['chars', 'net', 'set', 'v']);
  assert.ok(!JSON.stringify(srv.linhas.get(U).data).match(/access_token|refresh_token|sodual\.auth/));
  const rpcs = srv.rpcs; d.run('SYNC_CFG.limite=500;S.chars[0].notes="y".repeat(600);save()');
  assert.ok(await ate(() => d.estado === 'grande')); assert.equal(srv.rpcs, rpcs);
  assert.equal(JSON.parse(d.mem[`sodual.v1.u.${U}`]).chars[0].notes.length, 600, 'continua salvo localmente');
});

/* ===================== Entrega 3 — resolução de conflitos e exclusão da nuvem ===================== */
/* Dois dispositivos em conflito: o PC gravou depois que o celular carregou; o celular tem uma mudança local própria. */
async function emConflito() {
  const srv = new Servidor(), pc = dispositivo(); await pc.entrar(srv, U); criarFicha(pc); await ate(() => pc.estado === 'salvo');
  const cel = dispositivo(); await cel.entrar(srv, U);
  pc.run('S.chars[0].mana=2;save()'); await ate(() => srv.linhas.get(U).revision === 2 && pc.estado === 'salvo');
  cel.run('S.chars[0].bag.push({id:"x",nome:"Corda",qtd:1,cat:"Item comum"});save()');
  assert.ok(await ate(() => cel.estado === 'conflito'));
  return { srv, pc, cel };
}

test('detalhes do conflito: resumo das duas versões, revisão e dispositivo da nuvem; data local real (não inventada)', async () => {
  const { cel } = await emConflito();
  const d = await cel.run('syncConflitoDetalhes()');
  assert.equal(d.remoto.revision, 2); assert.equal(d.remoto.resumo.mana, 2); assert.equal(d.local.resumo.nome, 'Lia');
  assert.ok(d.remoto.dispositivo); assert.ok(d.local.mod, 'edição feita nesta sessão tem data');
  const velho = dispositivo(dadosLocais(U)), srv2 = new Servidor(); srv2.linhas.set(U, { data: { v: 3, chars: [{ id: 'z', nome: 'Outra' }], net: {}, set: {} }, revision: 4, updated_at: 'x' });
  assert.equal(await velho.entrar(srv2, U), 'conflito');
  const d2 = await velho.run('syncConflitoDetalhes()');
  assert.equal(d2.local.mod, null, 'dados antigos sem metadado: sem data inventada'); assert.equal(d2.local.at, null);
});

test('manter versão da nuvem: adota a nuvem, guarda a deste dispositivo e volta a sincronizar normalmente', async () => {
  const { srv, cel } = await emConflito(); const rpcs = srv.rpcs;
  const r = await cel.run('syncManterNuvem()');
  assert.equal(r.ok, true); assert.equal(cel.estado, 'salvo'); assert.equal(srv.rpcs, rpcs, 'manter a nuvem não grava nada nela');
  assert.equal(cel.S.chars[0].mana, 2); assert.equal(cel.S.chars[0].bag.length, 0);
  const copia = JSON.parse(cel.mem[`sodual.v1.u.${U}.antes-nuvem`]);
  assert.equal(copia.dados.chars[0].bag[0].nome, 'Corda', 'a versão do celular ficou guardada');
  cel.run('S.chars[0].notes="ok";save()'); assert.ok(await ate(() => cel.estado === 'salvo' && srv.linhas.get(U).revision === 3));
});

test('manter versão deste dispositivo: grava sobre a revisão vista, guarda a da nuvem; o outro dispositivo passa a ter conflito', async () => {
  const { srv, pc, cel } = await emConflito();
  const d = await cel.run('syncConflitoDetalhes()');
  const r = await cel.run(`syncManterDispositivo(${d.remoto.revision})`);
  assert.equal(r.ok, true); assert.equal(r.revision, 3); assert.equal(cel.estado, 'salvo');
  assert.equal(srv.linhas.get(U).data.chars[0].bag[0].nome, 'Corda');
  assert.equal(JSON.parse(cel.mem[`sodual.v1.u.${U}.nuvem-substituida`]).dados.chars[0].mana, 2, 'a versão anterior da nuvem ficou guardada');
  pc.run('S.chars[0].mana=9;save()'); assert.ok(await ate(() => pc.estado === 'conflito'), 'o PC desatualizado não sobrescreve');
  assert.equal(srv.linhas.get(U).revision, 3);
});

test('a nuvem muda enquanto o jogador decide: a confirmação vira novo conflito e nada é sobrescrito', async () => {
  const { srv, pc, cel } = await emConflito();
  const d = await cel.run('syncConflitoDetalhes()');                 // jogador viu a revisão 2
  pc.run('S.chars[0].mana=7;save()'); await ate(() => srv.linhas.get(U).revision === 3);
  const r = await cel.run(`syncManterDispositivo(${d.remoto.revision})`);
  assert.equal(r.ok, false); assert.equal(r.motivo, 'conflito'); assert.equal(r.revision, 3);
  assert.equal(srv.linhas.get(U).data.chars[0].mana, 7); assert.equal(cel.estado, 'conflito');
  assert.equal(cel.run('SY.conflito.remoto.revision'), 3, 'a tela recebe a revisão nova para mostrar');
  const d2 = await cel.run('syncConflitoDetalhes()'); assert.equal(d2.remoto.resumo.mana, 7);
  assert.equal((await cel.run(`syncManterDispositivo(${d2.remoto.revision})`)).ok, true);
});

test('conflito por exclusão remota: é possível recriar a nuvem a partir deste dispositivo', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  srv.linhas.delete(U); d.run('S.chars[0].mana=1;save()'); await ate(() => d.estado === 'conflito');
  const x = await d.run('syncConflitoDetalhes()'); assert.equal(x.remoto, null);
  assert.equal((await d.run('syncManterNuvem()')).motivo, 'sem-nuvem');
  assert.equal((await d.run('syncManterDispositivo(0)')).ok, true); assert.equal(srv.linhas.get(U).revision, 1);
});

test('excluir dados da nuvem: apaga só a nuvem, guarda cópia, mantém o dispositivo e não reenvia sozinho', async () => {
  const srv = new Servidor(), d = dispositivo(); await d.entrar(srv, U); criarFicha(d); await ate(() => d.estado === 'salvo');
  const r = await d.run('syncExcluirNuvem()');
  assert.equal(r.ok, true); assert.equal(srv.linhas.size, 0); assert.equal(d.estado, 'adiado');
  assert.equal(d.S.chars[0].nome, 'Lia'); assert.ok(d.mem[`sodual.v1.u.${U}.nuvem-excluida`]);
  const rpcs = srv.rpcs; d.run('S.chars[0].mana=2;save()'); await espera(60); assert.equal(srv.rpcs, rpcs, 'nada reenviado sem pedido');
  const d2 = dispositivo(d.mem); assert.equal(await d2.entrar(srv, U), 'migrar', 'no próximo acesso, pergunta de novo');
  d2.run('syncMigrar()'); assert.ok(await ate(() => d2.estado === 'salvo')); assert.equal(srv.linhas.get(U).data.chars[0].mana, 2);
});

test('cópias de segurança não se sobrescrevem: substituir e depois excluir mantém as duas versões da nuvem', async () => {
  const { cel } = await emConflito();
  const d = await cel.run('syncConflitoDetalhes()'); await cel.run(`syncManterDispositivo(${d.remoto.revision})`);
  await cel.run('syncExcluirNuvem()');
  assert.equal(JSON.parse(cel.mem[`sodual.v1.u.${U}.nuvem-substituida`]).dados.chars[0].mana, 2, 'versão do PC continua guardada');
  assert.equal(JSON.parse(cel.mem[`sodual.v1.u.${U}.nuvem-excluida`]).dados.chars[0].bag[0].nome, 'Corda');
});

test('outro dispositivo, depois da exclusão remota, não recria a nuvem silenciosamente', async () => {
  const srv = new Servidor(), a = dispositivo(); await a.entrar(srv, U); criarFicha(a); await ate(() => a.estado === 'salvo');
  const b = dispositivo(); await b.entrar(srv, U);
  await a.run('syncExcluirNuvem()');
  b.run('S.chars[0].mana=4;save()'); assert.ok(await ate(() => b.estado === 'conflito'));
  assert.equal(b.run('SY.conflito.tipo'), 'remoto-apagado'); assert.equal(srv.linhas.size, 0);
});

test('cenário E: dados de antes do login só entram na conta por escolha explícita e o original continua no navegador', async () => {
  const legado = JSON.stringify({ v: 3, chars: [{ id: 'leg', nome: 'Do legado', a: {}, w: {} }], net: { pos: {}, edges: [], people: [] }, set: { nome: 'X' } });
  const srv = new Servidor(), d = dispositivo({ 'sodual.v1': legado });
  assert.equal(await d.entrar(srv, U), 'vazio'); await espera(60); assert.equal(srv.rpcs, 0, 'o legado não é enviado sozinho');
  d.run('S=norm(JSON.parse(localStorage.getItem("sodual.v1")));save()');   // o que importLegacy() faz após o "Usar nesta conta"
  assert.ok(await ate(() => d.estado === 'salvo')); assert.equal(srv.linhas.get(U).data.chars[0].id, 'leg');
  assert.equal(d.mem['sodual.v1'], legado, 'chave antiga intacta');
});

test('decisão inicial (tabela de casos)', () => {
  const d = dispositivo(), dec = (remoto, meta, local) => { d.ctx.__a = { remoto, meta, localStr: d.run(`syncStr(${JSON.stringify(local)})`) }; return d.run('syncDecidir(__a)'); };
  const cheio = { v: 3, chars: [{ id: 'a' }], net: { people: [], edges: [] }, set: {} }, vazio = { v: 3, chars: [], net: { people: [], edges: [] }, set: { nome: 'X' } };
  const h = o => d.run(`syncHash(syncStr(${JSON.stringify(o)}))`), m0 = { rev: 0, hash: '' };
  assert.equal(dec(null, m0, vazio), 'vazio');
  assert.equal(dec(null, m0, cheio), 'migrar');
  assert.equal(dec(null, { rev: 3, hash: h(cheio) }, cheio), 'remoto-apagado');
  assert.equal(dec({ data: cheio, revision: 2 }, m0, cheio), 'igual');
  assert.equal(dec({ data: cheio, revision: 2 }, m0, vazio), 'adotar');
  assert.equal(dec({ data: { ...cheio, v: 4 }, revision: 2 }, { rev: 2, hash: h({ ...cheio, v: 4 }) }, cheio), 'enviar');
  assert.equal(dec({ data: { ...cheio, v: 4 }, revision: 5 }, { rev: 2, hash: h(cheio) }, cheio), 'adotar');
  assert.equal(dec({ data: { ...cheio, v: 4 }, revision: 5 }, { rev: 2, hash: 'outro' }, cheio), 'conflito');
  assert.equal(dec({ data: { ...cheio, v: 4 }, revision: 5 }, m0, cheio), 'conflito');
  assert.equal(dec({ data: cheio, revision: 1 }, { rev: 4, hash: 'x' }, { ...cheio, v: 9 }), 'conflito');
});
