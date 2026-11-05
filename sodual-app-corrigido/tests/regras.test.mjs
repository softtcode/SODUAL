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
