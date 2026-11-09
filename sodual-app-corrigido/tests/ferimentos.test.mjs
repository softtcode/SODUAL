// Testes de ferimentos, Fatal, morte imediata e desmembramento — execute com:  node --test "tests/*.test.mjs"
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
const LEVE = 1, INTER = 2, ALTO = 3, GRAVE = 4, FATAL = 5;
const REGS = ['cabeca', 'tronco', 'bd', 'be', 'pd', 'pe'], MEMBROS = ['bd', 'be', 'pd', 'pe'];
/* Ficha com todas as regiões saudáveis (normFerimentos completa o formato). */
const ficha = () => F.normFerimentos({ dead: false, w: {} });
const nunca = () => { throw new Error('não deveria rolar 1D4'); };
/* Leva uma região ao grau g aplicando só ferimentos equivalentes (caminho da regra). */
function ate(c, r, g) { for (let x = 1; x < g; x++) while (c.w[r].g <= x) F.wound(c, r, c.w[r].g || 1, nunca); if (g > 1) assert.equal(c.w[r].g, g); }

/* ===== Progressão ===== */
test('cabeça e tronco: estado + ferimento do mesmo grau = próximo grau, até Fatal', () => {
  for (const r of ['cabeca', 'tronco']) {
    const c = ficha();
    F.wound(c, r, LEVE); F.wound(c, r, LEVE);
    assert.equal(c.w[r].g, INTER, r + ': Leve + Leve');
    assert.deepEqual({ ...F.progresso(c, r) }, { h: 1, n: 2 });       // o próprio estado conta como 1
    F.wound(c, r, INTER);
    assert.equal(c.w[r].g, ALTO, r + ': Intermediário + Intermediário');
    F.wound(c, r, ALTO);
    assert.equal(c.w[r].g, GRAVE, r + ': Alto + Alto');
    F.wound(c, r, GRAVE);
    assert.equal(c.w[r].g, FATAL, r + ': Grave + Grave');
    assert.equal(F.progresso(c, r), null);
    assert.equal(c.dead, false);
  }
});

test('exemplo: região em Alto precisa de outro Alto para chegar a Grave', () => {
  const c = ficha();
  F.wound(c, 'tronco', ALTO);                           // Alto direto: 1/2
  F.wound(c, 'tronco', INTER);                          // grau menor não conta
  assert.equal(c.w.tronco.g, ALTO);
  F.wound(c, 'tronco', ALTO);
  assert.equal(c.w.tronco.g, GRAVE);
});

test('braços e pernas: 3 Leves → Intermediário; 3 Intermediários → Alto; depois, 2 graus iguais', () => {
  for (const r of MEMBROS) {
    const c = ficha();
    F.wound(c, r, LEVE); F.wound(c, r, LEVE);
    assert.equal(c.w[r].g, LEVE, r + ': 2 Leves ainda não sobem');
    assert.deepEqual({ ...F.progresso(c, r) }, { h: 2, n: 3 });
    F.wound(c, r, LEVE);
    assert.equal(c.w[r].g, INTER, r + ': 3 Leves');
    assert.deepEqual({ ...F.progresso(c, r) }, { h: 1, n: 3 });     // o estado conta como o 1º Intermediário
    F.wound(c, r, INTER);
    assert.equal(c.w[r].g, INTER, r + ': 2 Intermediários ainda não sobem');
    F.wound(c, r, INTER);
    assert.equal(c.w[r].g, ALTO, r + ': 3 Intermediários');
    for (const g of [ALTO, GRAVE]) {
      assert.deepEqual({ ...F.progresso(c, r) }, { h: 1, n: 2 });   // o próprio estado conta como 1
      F.wound(c, r, g);
      assert.equal(c.w[r].g, g + 1, r + ': ' + g + ' + ' + g);
    }
    assert.equal(c.w[r].g, FATAL);
    assert.equal(F.progresso(c, r), null);
  }
});

test('exemplo: membro em Alto precisa de outro Alto para chegar a Grave', () => {
  const c = ficha();
  F.wound(c, 'be', ALTO);
  F.wound(c, 'be', LEVE); F.wound(c, 'be', INTER);       // graus menores não contam
  assert.equal(c.w.be.g, ALTO);
  F.wound(c, 'be', ALTO);
  assert.equal(c.w.be.g, GRAVE);
});

test('contadores independentes por região (inclusive braço x braço e perna x perna)', () => {
  const c = ficha();
  F.wound(c, 'be', LEVE); F.wound(c, 'be', LEVE);
  F.wound(c, 'bd', LEVE);
  F.wound(c, 'pe', INTER);
  assert.deepEqual({ ...F.progresso(c, 'be') }, { h: 2, n: 3 });
  assert.deepEqual({ ...F.progresso(c, 'bd') }, { h: 1, n: 3 });
  assert.deepEqual({ ...F.progresso(c, 'pe') }, { h: 1, n: 3 });   // Intermediário: 3 nos membros
  assert.equal(F.progresso(c, 'pd'), null);
  assert.equal(c.w.cabeca.g, 0); assert.equal(c.w.tronco.g, 0);
  F.wound(c, 'be', LEVE);
  assert.equal(c.w.be.g, INTER); assert.equal(c.w.bd.g, LEVE);
  assert.equal(c.w.be.cnt[LEVE], 3); assert.equal(c.w.bd.cnt[LEVE], 1);
});

/* ===== Acumulação de ferimentos de grau menor ===== */
test('1. ferimento inferior fica armazenado mesmo com a região em grau superior', () => {
  const c = ficha();
  F.wound(c, 'tronco', INTER);                         // Intermediário 1/2
  const ev = F.wound(c, 'tronco', LEVE);
  assert.equal(c.w.tronco.g, INTER);
  assert.deepEqual({ ...F.progresso(c, 'tronco') }, { h: 1, n: 2 });
  assert.equal(c.w.tronco.ac[LEVE], 1);
  assert.equal(ev.ef, 'inferior');
  assert.match(F.descreverEvento(ev), /acumulado \(1\/2 para formar 1 Intermediário\)/);
});

test('2. dois Leves formam um Intermediário no tronco (também acumulados sob grau maior)', () => {
  const c = ficha();
  F.wound(c, 'tronco', LEVE); F.wound(c, 'tronco', LEVE);
  assert.equal(c.w.tronco.g, INTER);
  const d = ficha();
  F.wound(d, 'tronco', ALTO);                          // Alto 1/2
  F.wound(d, 'tronco', LEVE); F.wound(d, 'tronco', LEVE);
  assert.equal(d.w.tronco.ac[LEVE], 0);                // consumidos
  assert.equal(d.w.tronco.ac[INTER], 1);               // viraram 1 Intermediário acumulado
  assert.equal(d.w.tronco.g, ALTO);
});

test('3. Intermediário + Leve + Leve = Alto no tronco', () => {
  const c = ficha();
  F.wound(c, 'tronco', INTER);
  F.wound(c, 'tronco', LEVE);
  const ev = F.wound(c, 'tronco', LEVE);
  assert.equal(c.w.tronco.g, ALTO);
  assert.deepEqual({ ...F.progresso(c, 'tronco') }, { h: 1, n: 2 });
  assert.deepEqual([...c.w.tronco.ac], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...ev.conv], [LEVE]);
  assert.equal(ev.ef, 'agravou');
  assert.match(F.descreverEvento(ev), /2 Leves formaram 1 Intermediário · agravou de Intermediário para Alto/);
});

test('4. braços e pernas usam os limites configurados (3 Leves, 3 Intermediários, depois 2)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(F.NEED)), { 1: [2, 3], 2: [2, 3], 3: [2, 2], 4: [2, 2] });
  const c = ficha();
  F.wound(c, 'be', INTER);                             // Intermediário 1/3
  F.wound(c, 'be', LEVE); F.wound(c, 'be', LEVE);
  assert.equal(c.w.be.ac[LEVE], 2); assert.equal(c.w.be.g, INTER);   // 2 Leves ainda não formam Intermediário no braço
  F.wound(c, 'be', LEVE);                              // 3 Leves → 1 Intermediário → 2/3
  assert.equal(c.w.be.g, INTER); assert.deepEqual({ ...F.progresso(c, 'be') }, { h: 2, n: 3 });
  F.wound(c, 'be', LEVE); F.wound(c, 'be', LEVE); F.wound(c, 'be', LEVE);   // mais 3 Leves → 3º Intermediário → Alto
  assert.equal(c.w.be.g, ALTO);
  const d = ficha();
  F.wound(d, 'pd', GRAVE);                             // Grave 1/2
  F.wound(d, 'pd', ALTO); assert.equal(d.w.pd.g, GRAVE);
  F.wound(d, 'pd', ALTO);                              // 2 Altos (limite 2 no membro) → 1 Grave → Fatal
  assert.equal(d.w.pd.g, FATAL);
});

test('5. conversões sucessivas não usam o mesmo ferimento duas vezes', () => {
  const c = ficha();
  F.wound(c, 'cabeca', GRAVE);                         // Grave 1/2
  // 4 Leves → 2 Intermediários → 1 Alto (acumulado); mais 4 Leves → outro Alto → 2 Altos → 1 Grave → Fatal
  for (let i = 0; i < 4; i++) F.wound(c, 'cabeca', LEVE);
  assert.deepEqual([...c.w.cabeca.ac], [0, 0, 0, 1, 0, 0]);
  assert.equal(c.w.cabeca.g, GRAVE);
  for (let i = 0; i < 3; i++) F.wound(c, 'cabeca', LEVE);
  assert.deepEqual([...c.w.cabeca.ac], [0, 1, 1, 1, 0, 0]);
  const ev = F.wound(c, 'cabeca', LEVE);
  assert.deepEqual([...ev.conv], [LEVE, INTER, ALTO]); // uma cadeia por impacto
  assert.equal(c.w.cabeca.g, FATAL);
  assert.deepEqual([...c.w.cabeca.ac], [0, 0, 0, 0, 0, 0]);
  assert.equal(c.w.cabeca.cnt[LEVE], 8);
  // conservação: 8 Leves = 4 Intermediários = 2 Altos = 1 Grave, que somado ao Grave do estado forma o Fatal
});

test('grau maior não descarta os ferimentos do grau anterior', () => {
  const c = ficha();
  F.wound(c, 'tronco', LEVE);                          // Leve 1/2
  const ev = F.wound(c, 'tronco', ALTO);               // Alto 1/2, o Leve vai para o acumulador
  assert.equal(c.w.tronco.g, ALTO); assert.equal(c.w.tronco.ac[LEVE], 1);
  assert.match(F.descreverEvento(ev), /1 Leve anterior\(es\) mantido\(s\) no acumulador/);
  F.wound(c, 'tronco', LEVE);                          // 2 Leves → Intermediário acumulado
  assert.equal(c.w.tronco.ac[INTER], 1); assert.equal(c.w.tronco.g, ALTO);
});

test('um novo impacto nunca diminui a gravidade; Fatal acumula sem formar outro Fatal', () => {
  const c = ficha();
  ate(c, 'tronco', FATAL);
  for (let i = 0; i < 6; i++) F.wound(c, 'tronco', GRAVE);
  assert.equal(c.w.tronco.g, FATAL);
  assert.equal(c.w.tronco.ac[GRAVE], 6);               // guardados, sem conversão além do limite
  for (const g of [LEVE, INTER, ALTO]) for (let i = 0; i < 5; i++) { const a = c.w.tronco.g; F.wound(c, 'tronco', g); assert.ok(c.w.tronco.g >= a); }
});

test('7. acumuladores de regiões diferentes são independentes', () => {
  const c = ficha();
  F.wound(c, 'tronco', ALTO); F.wound(c, 'cabeca', ALTO);
  F.wound(c, 'tronco', LEVE);
  F.wound(c, 'bd', INTER); F.wound(c, 'bd', LEVE); F.wound(c, 'be', LEVE);
  assert.equal(c.w.tronco.ac[LEVE], 1); assert.equal(c.w.cabeca.ac[LEVE], 0);
  assert.equal(c.w.bd.ac[LEVE], 1); assert.equal(c.w.be.ac[LEVE], 0); assert.equal(c.w.be.g, LEVE);
  F.wound(c, 'cabeca', LEVE);
  assert.equal(c.w.tronco.ac[INTER], 0);               // o Leve da cabeça não completa o par do tronco
});

test('curar a região zera os acumuladores; amputação continua', () => {
  const c = ficha();
  ate(c, 'pe', FATAL); F.wound(c, 'pe', INTER, () => 4); F.wound(c, 'pe', LEVE, nunca); F.wound(c, 'pe', LEVE, nunca);
  assert.equal(c.w.pe.ac[LEVE], 2);
  F.ajusteRegiao(c, 'pe', 'curar');
  assert.deepEqual([...c.w.pe.ac], [0, 0, 0, 0, 0, 0]); assert.equal(c.w.pe.amp, 1);
});

test('grau maior não é reduzido a impacto leve: define o grau (interpretação mantida)', () => {
  const c = ficha();
  F.wound(c, 'cabeca', LEVE);
  F.wound(c, 'cabeca', ALTO);
  assert.equal(c.w.cabeca.g, ALTO);
  assert.deepEqual({ ...F.progresso(c, 'cabeca') }, { h: 1, n: 2 });
});

test('Fatal é o limite: sem contador negativo nem além de Fatal; entradas inválidas são ignoradas', () => {
  const c = ficha();
  ate(c, 'tronco', FATAL);
  F.wound(c, 'tronco', FATAL); F.wound(c, 'tronco', GRAVE);
  assert.equal(c.w.tronco.g, FATAL);
  assert.equal(F.wound(c, 'tronco', 6), null);
  assert.equal(F.wound(c, 'tronco', 0), null);
  assert.equal(F.wound(c, 'asa', 1), null);
  const d = ficha();
  F.ajusteRegiao(d, 'be', 'impacto');
  assert.equal(d.w.be.h, 0);
  const n = F.normFerimentos({ w: { be: { g: 9, h: -4 }, bd: { g: 2, h: 99 } } });
  assert.equal(n.w.be.g, FATAL); assert.equal(n.w.be.h, 0);
  assert.equal(n.w.bd.h, 2);                          // nunca chega a 3/3 sem subir de grau
});

test('rascunho rolado com a quantidade antiga de dados é preservado à parte e exige nova rolagem', () => {
  const wiz = { povo: 'Arveni', a: { cor: 2 }, mr: { povo: 'Arveni', dados: [3, 3, 3, 3, 3], soma: 15, usadas: 1, ok: true } };
  const e = load({ 'sodual.v1': JSON.stringify({ v: 3, chars: [], wiz }) });
  const w = JSON.parse(JSON.stringify(e.get('S').wiz));
  assert.equal(w.mr, undefined);
  assert.deepEqual(w.mrAntiga.dados, [3, 3, 3, 3, 3]);
  const ok = { ...wiz, mr: { povo: 'Arveni', dados: [3, 3, 3], soma: 9, usadas: 1, ok: true } };
  assert.equal(load({ 'sodual.v1': JSON.stringify({ v: 3, chars: [], wiz: ok }) }).get('S').wiz.mr.soma, 9);
});

/* ===== Fatal e morte ===== */
test('atingir Fatal não mata automaticamente', () => {
  const c = ficha();
  ate(c, 'tronco', FATAL);                              // Grave + Grave
  assert.equal(c.dead, false);
  F.wound(c, 'tronco', LEVE);                            // mais ferimentos na mesma região Fatal
  assert.equal(c.dead, false);
  const d = ficha();
  F.wound(d, 'cabeca', FATAL);                          // Fatal direto, primeiro Fatal da ficha
  assert.equal(d.dead, false);
  assert.equal(d.w.cabeca.g, FATAL);
});

for (const [nome, g, morre] of [['Alto', ALTO, true], ['Grave', GRAVE, true], ['Fatal', FATAL, true], ['Leve', LEVE, false], ['Intermediário', INTER, false]]) {
  test(`Fatal prévio + novo ${nome} em outra região ${morre ? 'provoca' : 'não provoca'} morte`, () => {
    const c = ficha();
    ate(c, 'tronco', FATAL);
    const ev = F.wound(c, 'be', g);
    assert.equal(c.dead, morre);
    assert.equal(ev.morte, morre);
    if (morre) { assert.equal(c.morte.reg, 'be'); assert.equal(c.morte.g, g); }
  });
}

test('exemplos do enunciado: A, B, C e D', () => {
  let c = ficha(); ate(c, 'tronco', FATAL); F.wound(c, 'be', ALTO); assert.equal(c.dead, true, 'A');
  c = ficha(); ate(c, 'tronco', FATAL); F.wound(c, 'be', INTER); assert.equal(c.dead, false, 'B');
  c = ficha(); ate(c, 'tronco', FATAL); F.wound(c, 'tronco', ALTO); assert.equal(c.dead, false, 'C');
  c = ficha(); ate(c, 'cabeca', FATAL); F.wound(c, 'pd', GRAVE); assert.equal(c.dead, true, 'D');
});

test('usa o estado anterior: região que acabou de virar Fatal não conta como Fatal prévio', () => {
  const c = ficha();
  ate(c, 'pe', GRAVE);
  assert.equal(c.w.pe.g, GRAVE);
  F.wound(c, 'pe', GRAVE);                              // Grave + Grave: pe vira Fatal agora
  assert.equal(c.w.pe.g, FATAL); assert.equal(c.dead, false);
  F.wound(c, 'pe', ALTO);                               // mesma região
  assert.equal(c.dead, false);
});

test('morte não é disparada de novo e a ficha é preservada', () => {
  const c = ficha();
  ate(c, 'tronco', FATAL);
  F.wound(c, 'be', ALTO);
  const ev = F.wound(c, 'bd', GRAVE);
  assert.equal(ev.morte, false);
  assert.equal(c.cb.filter(e => e.morte).length, 1);
  assert.equal(c.w.bd.g, GRAVE);                        // novos ferimentos continuam registrados
  assert.equal(c.morte.reg, 'be');
  F.desfazerMorte(c);
  assert.equal(c.dead, false);
});

/* ===== Desmembramento ===== */
test('Fatal em braço + novo Intermediário rola 1D4; 4 amputa (ed. 0.4)', () => {
  const c = ficha();
  ate(c, 'be', FATAL);
  let rolou = 0;
  const ev = F.wound(c, 'be', INTER, () => { rolou++; return 4; });
  assert.equal(rolou, 1);
  assert.equal(ev.d4, 4); assert.equal(ev.amp, true);
  assert.equal(c.w.be.amp, 1); assert.equal(F.membro(c, 'be'), 'Amputado');
  assert.equal(F.membro(c, 'bd'), 'Íntegro');
  assert.match(F.descreverEvento(ev), /Teste de desmembramento: 1D4 → 4 — Braço esquerdo amputado!/);
});

test('Fatal em perna + novo Intermediário rola 1D4; 1, 2 e 3 não amputam', () => {
  for (const x of [1, 2, 3]) {
    const c = ficha();
    ate(c, 'pd', FATAL);
    const ev = F.wound(c, 'pd', INTER, () => x);
    assert.equal(ev.d4, x); assert.equal(ev.amp, false); assert.equal(c.w.pd.amp, 0);
  }
});

test('sem teste de desmembramento fora das condições', () => {
  const c = ficha();
  ate(c, 'be', GRAVE);
  F.wound(c, 'be', INTER, nunca);                       // membro não Fatal
  ate(c, 'bd', FATAL);
  F.wound(c, 'bd', LEVE, nunca);                        // ed. 0.4: Leve em membro Fatal não rola
  for (const r of ['cabeca', 'tronco']) {               // cabeça e tronco nunca
    const d = ficha(); ate(d, r, FATAL);
    const ev = F.wound(d, r, INTER, nunca);
    assert.equal(ev.d4, null); assert.equal(d.w[r].amp, 0);
    assert.equal(F.ajusteRegiao(d, r, 'amputar'), null);
  }
});

test('membro amputado não é amputado de novo e permanece amputado', () => {
  const c = ficha();
  ate(c, 'pe', FATAL);
  F.wound(c, 'pe', INTER, () => 4);
  const ev = F.wound(c, 'pe', GRAVE, nunca);
  assert.equal(ev.d4, null);
  F.ajusteRegiao(c, 'pe', 'curar'); F.ajusteRegiao(c, 'pe', 'definir', 0); F.ajusteRegiao(c, 'pe', 'grau');
  assert.equal(c.w.pe.amp, 1);                          // ajustes de grau não regeneram
  assert.equal(F.ajusteRegiao(c, 'pe', 'amputar'), null);
});

test('amputação manual e correção ficam no histórico', () => {
  const c = ficha();
  F.ajusteRegiao(c, 'bd', 'amputar');
  assert.equal(c.w.bd.amp, 1);
  F.ajusteRegiao(c, 'bd', 'desamputar');
  assert.equal(c.w.bd.amp, 0);
  assert.equal(c.cb.length, 2);
});

test('histórico registra região, grau, antes, depois, 1D4, amputação e morte', () => {
  const c = ficha();
  ate(c, 'tronco', FATAL);
  F.wound(c, 'be', ALTO);                               // outra região, Alto: morte imediata
  const ev = c.cb[0];
  for (const k of ['reg', 'g', 'antes', 'depois', 'd4', 'amp', 'morte', 't']) assert.ok(k in ev, k);
  assert.deepEqual([ev.reg, ev.g, ev.antes.g, ev.depois.g, ev.morte], ['be', ALTO, 0, ALTO, true]);
  const d = ficha(); ate(d, 'pd', FATAL);
  const e2 = F.wound(d, 'pd', INTER, () => 4);
  assert.deepEqual([e2.d4, e2.amp, e2.antes.amp, e2.depois.amp], [4, true, 0, 1]);
});

test('ed. 0.4: membro Fatal + Alto, Grave ou Fatal sem morte direta rola 1D4; todos os resultados do D4', () => {
  for (const g of [ALTO, GRAVE, FATAL]) for (const x of [1, 2, 3, 4]) {
    const c = ficha(); ate(c, 'bd', FATAL);
    let rolou = 0; const ev = F.wound(c, 'bd', g, () => { rolou++; return x; });
    assert.equal(rolou, 1, 'grau ' + g); assert.equal(ev.d4, x); assert.equal(ev.amp, x === 4); assert.equal(c.w.bd.amp, x === 4 ? 1 : 0);
    assert.equal(c.dead, false); assert.equal(c.w.bd.g, FATAL);
  }
});

test('ed. 0.4: morte direta tem prioridade — sem rolagem de desmembramento como procedimento adicional', () => {
  const c = ficha(); ate(c, 'bd', FATAL); c.w.tronco.g = FATAL;          // duas regiões Fatais (montadas sem passar pela morte)
  const ev = F.wound(c, 'bd', ALTO, nunca);                               // outra região Fatal + Alto: morte
  assert.equal(ev.morte, true); assert.equal(ev.d4, null); assert.equal(c.w.bd.amp, 0); assert.equal(c.dead, true);
  const d = ficha(); ate(d, 'pe', FATAL); d.w.cabeca.g = FATAL;
  const e2 = F.wound(d, 'pe', INTER, () => 4);                            // Intermediário não mata: rola
  assert.equal(e2.morte, false); assert.equal(e2.d4, 4); assert.equal(d.w.pe.amp, 1);
});

test('ed. 0.4: texto do registro e das pendências não fala mais em "Leve ou Intermediário"', () => {
  assert.ok(!/Leve ou Intermediário/.test(JSON.stringify(F.PEND)));
  assert.ok(F.PEND.some(([t, p]) => t === 'livro' && /Intermediário ou superior/.test(p)));
});

/* ===== Persistência e compatibilidade ===== */
test('amputação, morte, contadores e histórico persistem ao salvar e recarregar', () => {
  const e = load();
  vm.runInContext(`LS="sodual.v1.u.t";S.chars=[normFerimentos({id:"x",nome:"X",a:{},w:{},post:"Neutra"})];
    const c=S.chars[0];for(let i=0;i<4;i++)for(let j=0;j<3;j++)wound(c,"be",c.w.be.g||1,()=>1);
    wound(c,"be",2,()=>4);wound(c,"tronco",2);wound(c,"cabeca",5);wound(c,"pd",3);wound(c,"pd",1);wound(c,"tronco",1);save()`, e.ctx);
  const e2 = load(e.mem);
  vm.runInContext('loadS("sodual.v1.u.t")', e2.ctx);
  const c = JSON.parse(JSON.stringify(e2.get('S').chars[0]));
  assert.equal(c.w.be.amp, 1); assert.equal(c.w.be.g, FATAL);
  assert.equal(c.dead, true);
  assert.equal(c.w.tronco.g, INTER); assert.equal(c.w.tronco.h, 1);
  assert.equal(c.w.be.cnt[LEVE], 3); assert.equal(c.w.be.cnt[INTER], 3);
  assert.ok(c.cb.length >= 15);
  // 6. acumuladores persistem: o Leve guardado no tronco completa o par depois de recarregar
  assert.equal(c.w.pd.ac[LEVE], 1); assert.equal(c.w.tronco.ac[LEVE], 1);
  vm.runInContext('wound(S.chars[0],"tronco",1)', e2.ctx);
  assert.equal(e2.get('S').chars[0].w.tronco.g, ALTO);
});

test('fichas antigas abrem sem perder ferimentos, amputação ou morte', () => {
  const antigo = { v: 3, chars: [{ id: 'a', nome: 'Antiga', a: {}, post: 'Neutra', dead: true,
    w: { cabeca: { g: 2, h: 1, amp: 0, log: ['x'] }, tronco: { g: 0, h: 0, amp: 0, log: [] }, bd: { g: 5, h: 0, amp: 1, log: [] },
      be: { g: 3, h: 1, amp: 0, log: [] }, pd: { g: 0, h: 0, amp: 0, log: [] }, pe: { g: 1, h: 2, amp: 0, log: [] } } }] };
  const e = load({ 'sodual.v1': JSON.stringify(antigo) });
  const c = JSON.parse(JSON.stringify(e.get('S').chars[0]));
  assert.equal(c.dead, true);
  assert.deepEqual([c.w.cabeca.g, c.w.cabeca.h, c.w.cabeca.log], [2, 1, ['x']]);
  assert.equal(c.w.bd.amp, 1); assert.equal(c.w.be.h, 1); assert.equal(c.w.pe.h, 2);
  assert.deepEqual(c.w.tronco.cnt, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(c.w.cabeca.ac, [0, 0, 0, 0, 0, 0]);   // 8. acumuladores novos começam vazios; grau e contador intactos
  assert.deepEqual(c.cb, []);
  vm.runInContext('wound(S.chars[0],"cabeca",1);wound(S.chars[0],"cabeca",1)', e.ctx);   // ficha antiga já acumula
  assert.equal(e.get('S').chars[0].w.cabeca.g, ALTO);    // Intermediário 1/2 + 2 Leves = Alto
  const vazio = load({ 'sodual.v1': JSON.stringify({ v: 3, chars: [{ id: 'b', nome: 'B', a: {}, w: {} }] }) });
  assert.deepEqual(Object.keys(vazio.get('S').chars[0].w), REGS);
});
