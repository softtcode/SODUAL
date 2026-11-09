// Testes das regras de combate, núcleos e rolagem de mana — execute com:  node --test "tests/*.test.mjs"
// Carrega src/rules.js e src/creation.js num contexto isolado (vm), com localStorage/document falsos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
function load(stored = {}) {
  const mem = { ...stored };
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const document = { getElementById: () => null, querySelector: () => ({ style: {} }) };
  const ctx = vm.createContext({ localStorage, document, console, setTimeout, clearTimeout });
  vm.runInContext(src('rules.js'), ctx, { filename: 'rules.js' });
  vm.runInContext(src('creation.js'), ctx, { filename: 'creation.js' });
  return { get: e => vm.runInContext(e, ctx), mem, ctx };
}
const env = load();
const F = new Proxy({}, { get: (_, k) => env.get(k) });
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
/* Ficha mínima para as regras de combate (mesma estrutura de mk). */
const ficha = (o = {}) => Object.assign({ post: 'Neutra', pesada: false, sk: { Luta: 3, Pontaria: 2 }, dead: false,
  w: Object.fromEntries(Object.keys(F.RG).map(k => [k, { g: 0, h: 0, amp: 0, log: [] }])) }, o);
/* Rascunho válido sem rolagem de mana. */
function rascunho() {
  const w = F.newW();
  Object.assign(w, { nome: 'Lia', idade: 18, povo: 'Arveni', origem: 'Camponês', hab: 'Leitura Social', per: ['Atletismo', 'Natureza'] });
  w.a = { for: 2, des: 2, cor: 2, car: 1, int: 2 };
  return w;
}
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

/* ===== Combate: postura Ofensiva (+2 ATK) ===== */
test('ofensiva: +2 no ataque, removido ao trocar de postura e sem acumular', () => {
  const c = ficha();
  assert.equal(F.atkPostura(c), 0);
  assert.equal(F.atkMod(c, 'Luta'), 3);               // ATK original
  assert.equal(F.setPostura(c, 'Ofensiva'), true);
  assert.equal(F.atkMod(c, 'Luta'), 5);               // +2
  F.setPostura(c, 'Ofensiva'); F.setPostura(c, 'Ofensiva');
  assert.equal(F.atkMod(c, 'Luta'), 5);               // não acumula
  assert.equal(c.sk.Luta, 3);                         // perícia base intacta
  F.setPostura(c, 'Neutra');
  assert.equal(F.atkMod(c, 'Luta'), 3);               // bônus removido
  F.setPostura(c, 'Defensiva');
  assert.equal(F.atkPostura(c), 0);
  assert.equal(F.setPostura(c, 'Agressiva'), false);  // postura inexistente
});

/* ===== Combate: arma pesada ===== */
test('arma pesada bloqueia Neutra e Defensiva e troca para Ofensiva', () => {
  const c = ficha({ post: 'Defensiva' });
  eq(F.posturasPermitidas(c), ['Ofensiva', 'Neutra', 'Defensiva']);
  F.setPesada(c, true);
  assert.equal(c.post, 'Ofensiva');
  eq(F.posturasPermitidas(c), ['Ofensiva']);
  assert.equal(F.setPostura(c, 'Neutra'), false);
  assert.equal(F.setPostura(c, 'Defensiva'), false);
  assert.equal(c.post, 'Ofensiva');
  assert.equal(F.atkPostura(c), 2);                   // modificadores recalculados na hora
  F.setPesada(c, false);
  assert.equal(c.post, 'Ofensiva');                   // não restaura a postura anterior
  assert.equal(F.setPostura(c, 'Neutra'), true);      // liberada de novo
});

test('estado inconsistente (pesada + Neutra) nunca vale: lógica e carga da ficha corrigem', () => {
  const c = ficha({ post: 'Neutra', pesada: true });
  assert.equal(F.post(c), 'Ofensiva');
  assert.equal(F.atkPostura(c), 2);
  const raw = JSON.stringify({ v: 3, chars: [{ id: 'x', nome: 'X', a: {}, w: {}, post: 'Defensiva', pesada: true }] });
  const e2 = load({ 'sodual.v1': raw });
  assert.equal(e2.get('S').chars[0].post, 'Ofensiva');
});

test('Defensiva com braço em Alto continua efetivamente Neutra', () => {
  const c = ficha({ post: 'Defensiva' });
  c.w.bd.g = 3;
  assert.equal(F.post(c), 'Neutra');
});

/* ===== Ferimentos: progressão por região ===== */
test('primeiro ferimento conta 1 impacto; contagem segue a tabela do livro', () => {
  const c = ficha();
  F.wound(c, 'cabeca', 1);
  eq(F.progresso(c, 'cabeca'), { h: 1, n: 2 });      // 1/2 rumo a Intermediário
  F.wound(c, 'cabeca', 1);
  assert.equal(c.w.cabeca.g, 2);                     // agravou
  eq(F.progresso(c, 'cabeca'), { h: 1, n: 2 });      // o próprio estado conta como 1
  F.wound(c, 'bd', 1);
  eq(F.progresso(c, 'bd'), { h: 1, n: 3 });          // membros: 3 impactos
  F.wound(c, 'bd', 1); eq(F.progresso(c, 'bd'), { h: 2, n: 3 });
  F.wound(c, 'bd', 1); assert.equal(c.w.bd.g, 2); eq(F.progresso(c, 'bd'), { h: 1, n: 3 }); // membros: 3 Intermediários para Alto
});

test('contadores independentes: uma região não altera a outra', () => {
  const c = ficha();
  F.wound(c, 'pe', 1); F.wound(c, 'pe', 1);
  eq(F.progresso(c, 'pd'), null);
  assert.equal(c.w.pd.g, 0);
  F.wound(c, 'tronco', 3);
  eq(F.progresso(c, 'tronco'), { h: 1, n: 2 });
  eq(F.progresso(c, 'pe'), { h: 2, n: 3 });
  assert.equal(c.w.cabeca.g, 0);
});

test('ferimento mais grave redefine o grau e conta 1 rumo ao próximo; Fatal não tem contador', () => {
  const c = ficha();
  F.wound(c, 'tronco', 1);
  F.wound(c, 'tronco', 4);
  assert.equal(c.w.tronco.g, 4); eq(F.progresso(c, 'tronco'), { h: 1, n: 2 });
  F.wound(c, 'tronco', 2);                           // grau menor: registrado, sem progressão
  assert.equal(c.w.tronco.g, 4); eq(F.progresso(c, 'tronco'), { h: 1, n: 2 });
  F.wound(c, 'tronco', 4);
  assert.equal(c.w.tronco.g, 5); eq(F.progresso(c, 'tronco'), null);
});

/* ===== Núcleos ===== */
test('núcleo: oito estágios na ordem exata, só valores válidos', () => {
  eq(F.NUC, ['Preto', 'Vermelho Escuro', 'Vermelho Sólido', 'Vermelho Claro', 'Laranja Escuro', 'Laranja Sólido', 'Laranja Claro', 'Amarelo Escuro', 'Amarelo Sólido', 'Amarelo Claro', 'Prata Escura', 'Prata Sólida', 'Prata Clara', 'Branco']);
  assert.equal(F.NUC_INI, 'Preto');
  for (const n of F.NUC) assert.ok(F.NUC_C[n], 'cor de ' + n);
  const c = ficha({ nucleo: '' });
  assert.equal(F.setNucleo(c, 'Laranja Claro'), true); assert.equal(c.nucleo, 'Laranja Claro');
  assert.equal(F.setNucleo(c, 'Laranja'), false);       // valor antigo não pode ser escolhido de novo
  assert.equal(F.setNucleo(c, 'Azul'), false);
  assert.equal(c.nucleo, 'Laranja Claro');
  assert.equal(F.setNucleo(c, ''), true);               // "não registrado" continua permitido
});

test('núcleo antigo é preservado sem conversão automática', () => {
  const raw = JSON.stringify({ v: 3, chars: [{ id: 'o', nome: 'Velha', a: {}, w: {}, nucleo: 'Laranja' }, ] });
  const e2 = load({ 'sodual.v1': raw });
  assert.equal(e2.get('S').chars[0].nucleo, 'Laranja');
  assert.equal(e2.get('nucleoValido("Laranja")'), false);
  assert.ok(e2.get('NUC_LEG').includes('Laranja'));
  const e3 = load({ 'sodual.v1': JSON.stringify({ v: 3, chars: [{ id: 'p', nome: 'P', a: {}, w: {}, nucleo: 'Vermelho Claro' }] }) });
  assert.equal(e3.get('S').chars[0].nucleo, 'Vermelho Claro');
});

/* ===== Mana: rolagem com até 3 tentativas ===== */
test('fórmulas raciais e limites dos resultados', () => {
  for (const [p, d] of [['Sáelios', 4], ['Arveni', 3], ['Dárnios', 2]]) {
    assert.equal(F.manaFormula(p), d + 'D4 + Corpo');
    const w = rascunho(); w.povo = p;
    for (let i = 0; i < 200; i++) {
      delete w.mr; F.rolarMana(w);
      assert.equal(w.mr.dados.length, d);
      assert.ok(w.mr.dados.every(x => x >= 1 && x <= 4));
      const t = F.calcManaInicial(w).total;
      assert.ok(t >= d + 2 && t <= d * 4 + 2, p + ' fora da faixa: ' + t);
    }
  }
  assert.equal(F.rolarMana(Object.assign(rascunho(), { povo: '' })).codigo, 'MANA_SEM_POVO');
});

test('no máximo três rolagens; cada nova substitui a anterior para sempre', () => {
  const w = rascunho();
  F.rolarMana(w, seq([4])); assert.equal(F.calcManaInicial(w).total, 14);   // 12 + 2
  F.rolarMana(w, seq([1])); assert.equal(F.calcManaInicial(w).total, 5);    // 3 + 2: o 14 se perdeu
  assert.equal(w.mr.usadas, 2); assert.equal(w.mr.ok, false);
  assert.equal(JSON.stringify(w).includes('[4,4,4]'), false);             // descartado não fica guardado
  F.rolarMana(w, seq([2]));
  assert.equal(F.calcManaInicial(w).total, 8);
  assert.equal(w.mr.usadas, 3); assert.equal(w.mr.ok, true);                 // terceira é definitiva
  assert.equal(F.rolarMana(w).ok, false);
  assert.equal(F.manaRestantes(w), 0);
  assert.equal(F.manterMana(w), false);
});

test('manter o resultado encerra as rolagens', () => {
  const w = rascunho();
  F.rolarMana(w, seq([3]));
  assert.equal(F.manterMana(w), true);
  eq(F.rolarMana(w), { ok: false, codigo: 'MANA_MANTIDA' });
  assert.equal(w.mr.usadas, 1);
});

test('tentativas persistem ao salvar e recarregar o rascunho', () => {
  const e = load();
  e.ctx.__w = Object.assign(e.get('newW')(), { povo: 'Dárnios', a: { for: 2, des: 2, cor: 3, car: 1, int: 1 } });
  vm.runInContext('LS="sodual.v1.u.t";rolarMana(__w,()=>2);rolarMana(__w,()=>3);S.wiz=__w;save()', e.ctx);
  const e2 = load(e.mem);
  vm.runInContext('loadS("sodual.v1.u.t")', e2.ctx);
  const w = e2.get('S.wiz');
  eq({ usadas: w.mr.usadas, soma: w.mr.soma, ok: w.mr.ok }, { usadas: 2, soma: 6, ok: false });
  assert.equal(e2.get('rolarMana(S.wiz,()=>1)').ok, true);
  assert.equal(e2.get('rolarMana(S.wiz,()=>1)').ok, false);                  // só restava 1 tentativa
  assert.equal(e2.get('setPovo(S.wiz,"Sáelios")').travado, true);            // trocar o povo não reinicia
});

test('fichas antigas mantêm a mana registrada; nada é rolado na migração', () => {
  const antigo = { v: 3, chars: [{ id: 'a', nome: 'Antiga', povo: 'Sáelios', a: { cor: 2 }, w: {}, manaMax: 26, mana: 11,
    mana0: { regra: 'dados-no-maximo', dados: '6D4', base: 24, corpo: 2, total: 26 } }] };
  const e = load({ 'sodual.v1': JSON.stringify(antigo) });
  const c = JSON.parse(JSON.stringify(e.get('S').chars[0]));
  assert.equal(c.manaMax, 26); assert.equal(c.mana, 11);
  eq(c.mana0, antigo.chars[0].mana0);
  assert.equal(e.get('S').wiz, undefined);                                    // migração não cria rascunho nem tentativas
  assert.equal(F.MANA_REGRA_ANTIGA, 'dados-no-maximo');
});

test('ficha criada registra a rolagem e a tentativa usada', () => {
  const w = rascunho();
  F.rolarMana(w, seq([1, 2, 3, 4]));
  F.manterMana(w);
  const c = F.mk(w);
  eq(c.mana0.rol, [1, 2, 3]);
  assert.equal(c.manaMax, 6 + 2);
  assert.equal(c.mana0.tentativa, 1);
  assert.equal('mr' in c, false);
});

/* ===== Livro I ed. 0.4 ===== */
test('0.4 posturas: Defensiva +3 cabeça/tronco e +1 membros; Neutra e Ofensiva inalteradas; ataque +2 da mesa preservado', () => {
  eq(F.POS, { Ofensiva: [0, 0], Neutra: [2, 0], Defensiva: [3, 1] });
  eq(F.ATK_POS, { Ofensiva: 2, Neutra: 0, Defensiva: 0 });
  const c = ficha({ post: 'Defensiva' });
  assert.equal(F.POS[F.post(c)][F.RG.cabeca[1]], 3); assert.equal(F.POS[F.post(c)][F.RG.bd[1]], 1);
  F.setPesada(c, true); assert.equal(F.post(c), 'Ofensiva');                    // arma pesada mantém a restrição
});

const comPovo = (povo, o = {}) => ficha(Object.assign({ povo }, o));
test('0.4 Tenacidade Física: só Dárnios; reduz 1 da penalidade final sem mudar o grau', () => {
  for (const povo of ['Arveni', 'Sáelios']) {
    const c = comPovo(povo); [1, 2, 3, 4, 5].forEach((g, i) => c.w[['cabeca', 'tronco', 'bd', 'be', 'pd'][i]].g = g);
    eq(['cabeca', 'tronco', 'bd', 'be', 'pd'].map(r => F.pen(c, r)), [0, -1, -2, -3, -3]); assert.equal(F.penGeral(c), -3); assert.equal(F.temTenacidade(c), false);
  }
  const d = comPovo('Dárnios'); [1, 2, 3, 4, 5].forEach((g, i) => d.w[['cabeca', 'tronco', 'bd', 'be', 'pd'][i]].g = g);
  eq(['cabeca', 'tronco', 'bd', 'be', 'pd'].map(r => F.pen(d, r)), [0, 0, -1, -2, -2]);
  eq(['cabeca', 'tronco', 'bd', 'be', 'pd'].map(r => F.penBase(d, r)), [0, -1, -2, -3, -3]);
  assert.equal(F.penGeral(d), -2); assert.equal(d.w.pd.g, 5);                    // grau gravado intacto
  assert.equal(F.penGeral(comPovo('Dárnios')), 0);                               // sem Fatal, sem penalidade geral
});

test('0.4 Tenacidade não impede agravamento, Fatal nem amputação, e não substitui a habilidade principal', () => {
  const d = comPovo('Dárnios', { hab: 'Mãos Firmes' });
  for (let i = 0; i < 12 && d.w.be.g < 5; i++) F.wound(d, 'be', d.w.be.g || 1, () => 1);
  assert.equal(d.w.be.g, 5);
  const ev = F.wound(d, 'be', 2, () => 4); assert.equal(ev.amp, true); assert.equal(d.w.be.amp, 1);
  assert.equal(F.pen(d, 'be'), -2); assert.equal(d.hab, 'Mãos Firmes');
  eq(F.PV['Dárnios'].comp.map(x => x[0]), ['Tenacidade Física']); assert.ok(!F.PV['Dárnios'].hab.some(x => x[0] === 'Tenacidade Física'));
});

test('0.4 Conhecimento Ampliado: Arveni registram 2 escolhas, sem bônus e sem mexer nas perícias', () => {
  const a = comPovo('Arveni', { hab: 'Leitura Social', sk: { Atletismo: 2 } });
  assert.equal(F.temConhecimento(a), true); eq(F.conhecimento(a), []);
  assert.equal(F.setConhecimento(a, 0, 'História'), true); assert.equal(F.setConhecimento(a, 1, 'Religião'), true);
  eq(a.ca, ['História', 'Religião']); eq(a.sk, { Atletismo: 2 }); assert.equal(a.hab, 'Leitura Social');
  assert.equal(F.setConhecimento(a, 1, 'História'), false);                       // repetida
  assert.equal(F.setConhecimento(a, 2, 'Medicina'), false);                       // só duas
  assert.equal(F.setConhecimento(a, 0, 'Voo'), false);                            // perícia inexistente
  assert.equal(F.setConhecimento(comPovo('Dárnios'), 0, 'História'), false);       // outros povos não têm
  assert.equal(F.setConhecimento(a, 0, ''), true); eq(a.ca, ['', 'Religião']);
});

test('0.4 núcleo: estágios antigos carregam sem mudança; Branco Puro é só nome de exibição; Amarelo identificado como mesa', () => {
  const raw = JSON.stringify({ v: 3, chars: [{ id: 'x', nome: 'X', povo: 'Dárnios', a: {}, w: {}, nucleo: 'Branco', mana: 4, manaMax: 9 }, ], net: { pos: {}, edges: [], people: [] }, set: { nome: 'J' } });
  const e = load({ 'sodual.v1': raw }); const c = JSON.parse(JSON.stringify(e.get('(loadS("sodual.v1"),S.chars[0])')));
  assert.equal(c.nucleo, 'Branco'); assert.equal(c.mana, 4); assert.equal(c.manaMax, 9); assert.equal(c.ca, undefined);
  assert.equal(F.nucNome('Branco'), 'Branco Puro'); assert.equal(F.nucNome('Prata Clara'), 'Prata Clara');
  eq(F.NUC.filter(n => F.NUC_FONTE(n) === 'mesa'), ['Amarelo Escuro', 'Amarelo Sólido', 'Amarelo Claro']);
  assert.equal(F.NUC_FONTE('Laranja'), '');                                       // legado: nem livro nem mesa
});

test('0.4 compatibilidade: carregar e salvar uma ficha antiga não altera nada (sem conflito falso de sincronização)', () => {
  const ficha0 = { v: 3, chars: [{ id: 'k1', nome: 'Antiga', povo: 'Arveni', origem: 'Camponês', hab: 'Leitura Social', a: { for: 2 }, sk: { Atletismo: 2 }, nucleo: 'Laranja', mana: 5, manaMax: 11, post: 'Defensiva', w: {}, cb: [], hist: { t: '', html: '' }, bag: [], magias: [], habs: [], money: [0, 0, 0] }], net: { pos: {}, edges: [], people: [] }, set: { nome: 'J' } };
  const e = load({ 'sodual.v1': JSON.stringify(ficha0) });
  const a = e.get('JSON.stringify(norm(JSON.parse(localStorage.getItem("sodual.v1"))))'), b = e.get('JSON.stringify(norm(JSON.parse(JSON.stringify(norm(JSON.parse(localStorage.getItem("sodual.v1")))))))');
  assert.equal(a, b, 'norm é idempotente');
  const c = JSON.parse(a).chars[0];
  assert.equal(c.nucleo, 'Laranja'); assert.equal(c.mana, 5); assert.equal(c.manaMax, 11); assert.equal(c.post, 'Defensiva'); assert.equal(c.ca, undefined); eq(c.sk, { Atletismo: 2 });
});

/* ===== 4.1: mana compartilhada (ficha, cabeçalho e Modo de Combate usam c.mana e estas funções) ===== */
test('mana: ajustes de 1 em 1 entre 0 e a máxima; núcleo, máxima e registro da rolagem intactos', () => {
  const c = { mana: 14, manaMax: 14, nucleo: 'Preto', mana0: { total: 14 } };
  assert.equal(F.ajustarMana(c, 1), 14);                                  // não passa da máxima
  assert.equal(F.ajustarMana(c, -1), 13); assert.equal(F.ajustarMana(c, -1), 12);
  for (let i = 0; i < 20; i++) F.ajustarMana(c, -1);
  assert.equal(c.mana, 0);                                                // nunca negativa
  assert.equal(F.ajustarMana(c, 1), 1);
  eq([c.manaMax, c.nucleo, c.mana0], [14, 'Preto', { total: 14 }]);
});
test('mana: valor digitado é saneado (inteiro, 0..máxima); registro antigo acima da máxima só desce', () => {
  const c = { mana: 5, manaMax: 9 };
  assert.equal(F.definirMana(c, '7'), 7); assert.equal(F.definirMana(c, 30), 9); assert.equal(F.definirMana(c, -4), 0);
  assert.equal(F.definirMana(c, 'abc'), 0); assert.equal(F.definirMana(c, 3.8), 3);
  const v = { mana: 12, manaMax: 9 };                                     // dado antigo/correção do mestre
  assert.equal(F.ajustarMana(v, 1), 12); assert.equal(F.ajustarMana(v, -1), 11);
  const s = { mana: 4, manaMax: 0 };                                       // sem máxima registrada: só o piso
  assert.equal(F.ajustarMana(s, 1), 5); assert.equal(F.definirMana(s, -1), 0);
});
test('mana: o ajuste passa pelo save() normal (localStorage) e o valor é o mesmo lido pela ficha', () => {
  const e = load(); vm.runInContext('LS="sodual.v1.u.m";S.chars=[{id:"m1",nome:"M",a:{},w:{},mana:14,manaMax:14,nucleo:"Preto"}];ajustarMana(S.chars[0],-2);save()', e.ctx);
  assert.equal(JSON.parse(e.mem['sodual.v1.u.m']).chars[0].mana, 12);
  const e2 = load(e.mem); assert.equal(e2.get('(loadS("sodual.v1.u.m"),S.chars[0].mana)'), 12); assert.equal(e2.get('S.chars[0].nucleo'), 'Preto');
});