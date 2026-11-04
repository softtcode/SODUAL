// Testes das regras de criação — execute com:  node --test tests/
// Sem dependências: carrega src/rules.js e src/creation.js num contexto isolado (vm), com localStorage/document falsos.
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
  const get = expr => vm.runInContext(expr, ctx);
  return { get, mem, ctx };
}
const { get } = load();
const F = new Proxy({}, { get: (_, k) => get(k) });
// Objetos vêm de outro realm (vm): compara pela estrutura JSON.
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const codes = r => r.erros.map(e => e.codigo);

/* Rascunho válido de referência */
function valido(over = {}) {
  const w = F.newW();
  Object.assign(w, { nome: 'Lia', idade: 18, povo: 'Arveni', origem: 'Camponês', hab: 'Leitura Social' });
  w.a = { for: 2, des: 2, cor: 2, car: 1, int: 2 };
  w.per = ['Atletismo', 'Natureza'];
  Object.assign(w, over);
  if (!('mr' in over) && F.PV[w.povo]) rolarFixo(w, 3);   // reserva rolada e mantida
  return w;
}
/* Rola a mana com dados fixos (rng determinístico) e mantém o resultado. */
function rolarFixo(w, face, manter = true) { F.rolarMana(w, () => face); if (manter) F.manterMana(w); return w; }

test('1. distribuição normal de 9 pontos é válida', () => {
  const r = F.validateCharacterCreation(valido());
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  eq(F.validateAttributes({ for: 5, des: 1, cor: 1, car: 1, int: 1 }), []);
});

test('2. um atributo em 0 com soma 9 é válido (o ponto liberado é redistribuído)', () => {
  eq(F.validateAttributes({ for: 0, des: 3, cor: 2, car: 2, int: 2 }), []);
  // soma 10 com um zero (bug da versão anterior) agora é rejeitada
  eq(F.validateAttributes({ for: 0, des: 3, cor: 3, car: 2, int: 2 }).map(e => e.codigo), ['ATR_PONTOS_EXCEDIDOS']);
  // a interface libera exatamente 1 ponto ao reduzir 1→0
  const a = { for: 1, des: 1, cor: 1, car: 1, int: 1 };
  assert.equal(F.resumoAtributos(a).restantes, 4);
  a.for = 0;
  assert.equal(F.resumoAtributos(a).restantes, 5);
});

test('3. dois atributos em 0 são rejeitados', () => {
  const e = F.validateAttributes({ for: 0, des: 0, cor: 4, car: 3, int: 2 });
  assert.ok(e.some(x => x.codigo === 'ATR_ZEROS'));
  assert.equal(F.podeAlterarAtributo({ for: 0, des: 1, cor: 3, car: 3, int: 2 }, 'des', -1), false);
  assert.equal(F.podeAlterarAtributo({ for: 1, des: 1, cor: 3, car: 2, int: 2 }, 'des', -1), true);
});

test('4. atributo acima de 5 é rejeitado (mesmo alterando o estado diretamente)', () => {
  const e = F.validateAttributes({ for: 6, des: 1, cor: 1, car: 1, int: 0 });
  assert.ok(e.some(x => x.codigo === 'ATR_ACIMA_MAX' && x.campo === 'a.for'));
  assert.equal(F.podeAlterarAtributo({ for: 5, des: 1, cor: 1, car: 1, int: 1 }, 'for', 1), false);
  assert.ok(F.validateAttributes({ for: 2.5, des: 1, cor: 1, car: 1, int: 3.5 }).some(x => x.codigo === 'ATR_INVALIDO'));
  assert.ok(F.validateAttributes({ for: -1, des: 3, cor: 3, car: 2, int: 2 }).some(x => x.codigo === 'ATR_NEGATIVO'));
});

test('5. pontos não distribuídos impedem a criação', () => {
  const r = F.validateCharacterCreation(valido({ a: { for: 1, des: 1, cor: 1, car: 1, int: 2 }, per: ['Atletismo', 'Natureza'] }));
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes('ATR_PONTOS_RESTANTES'));
  assert.equal(r.erros.find(e => e.codigo === 'ATR_PONTOS_RESTANTES').etapa, F.ETAPA.atributos);
});

test('6. mana: fórmula racial (D4 + Corpo) a partir da rolagem registrada', () => {
  assert.equal(F.manaFormula('Sáelios'), '6D4 + Corpo');
  assert.equal(F.manaFormula('Arveni'), '5D4 + Corpo');
  assert.equal(F.manaFormula('Dárnios'), '4D4 + Corpo');
  eq(F.manaLimites('Sáelios', 3), { min: 9, max: 27 });
  const w = valido({ mr: undefined }); delete w.mr;
  assert.equal(F.calcManaInicial(w), null);                 // sem rolagem não há reserva
  rolarFixo(w, 3);                                          // 5 dados × 3 = 15
  const m = F.calcManaInicial(w);
  eq({ ...m, rol: [...m.rol] }, { regra: 'rolagem-3-tentativas', dados: '5D4', rol: [3, 3, 3, 3, 3], base: 15, corpo: 2, total: 17, tentativa: 1, tentativas: 3 });
});

test('7. mana sem rolagem ou não mantida impede a criação', () => {
  const w = valido(); delete w.mr;
  assert.ok(codes(F.validateCharacterCreation(w)).includes('MANA_NAO_ROLADA'));
  rolarFixo(w, 2, false);
  assert.ok(codes(F.validateCharacterCreation(w)).includes('MANA_NAO_MANTIDA'));
  F.manterMana(w);
  assert.equal(F.validateCharacterCreation(w).ok, true);
  w.mr.soma = 99;                                           // rolagem adulterada
  assert.ok(codes(F.validateCharacterCreation(w)).includes('MANA_ROLAGEM_INVALIDA'));
});

test('8. alterar Corpo recalcula só o total, sem nova rolagem', () => {
  const w = valido();
  assert.equal(F.calcManaInicial(w).total, 17);
  F.setAtributo(w, 'car', 0); F.setAtributo(w, 'cor', 3);
  assert.equal(F.calcManaInicial(w).total, 18);
  assert.equal(w.mr.usadas, 1);
  assert.equal(F.mk(w).manaMax, 18);
});

test('9. trocar o povo limpa escolhas raciais; depois da rolagem o povo fica travado', () => {
  const w = valido({ per: ['Atletismo', 'Montaria'], hab: 'Leitura Social', mr: undefined }); delete w.mr;
  const rem = F.setPovo(w, 'Dárnios');
  eq([...w.per], ['Atletismo']);           // Atletismo existe nas duas listas
  eq([...rem.per], ['Montaria']);
  assert.equal(w.hab, '');
  assert.equal(rem.hab, 'Leitura Social');
  const r = F.validateCharacterCreation(w);
  assert.ok(codes(r).includes('PER_FALTANDO') && codes(r).includes('HAB_AUSENTE'));
  rolarFixo(w, 4, false);
  const t = F.setPovo(w, 'Sáelios');
  assert.equal(t.travado, true); assert.equal(w.povo, 'Dárnios');
  assert.equal(F.setPovo(w, 'Dárnios').travado, undefined);   // o mesmo povo continua aceito
});

test('10. Inteligência 0 exige zero perícias raciais', () => {
  const w = valido({ a: { for: 3, des: 2, cor: 2, car: 2, int: 0 }, per: [] });
  assert.equal(F.validateCharacterCreation(w).ok, true);
  const w2 = valido({ a: { for: 3, des: 2, cor: 2, car: 2, int: 0 }, per: ['Atletismo'] });
  assert.ok(codes(F.validateCharacterCreation(w2)).includes('PER_EXCESSO'));
  // reduzir Inteligência pela interface remove as excedentes
  const w3 = valido(); F.setAtributo(w3, 'int', 1);
  assert.equal(w3.per.length, 1);
});

test('11. quantidade de perícias diferente da Inteligência é rejeitada', () => {
  assert.ok(codes(F.validateCharacterCreation(valido({ per: ['Atletismo'] }))).includes('PER_FALTANDO'));
  assert.ok(codes(F.validateCharacterCreation(valido({ per: ['Atletismo', 'Natureza', 'Montaria'] }))).includes('PER_EXCESSO'));
  assert.ok(codes(F.validateCharacterCreation(valido({ per: ['Atletismo', 'Atletismo'] }))).includes('PER_DUPLICADA'));
  const w = valido({ per: ['Atletismo'] });
  assert.equal(F.togglePericia(w, 'Natureza'), true);
  assert.equal(F.togglePericia(w, 'Montaria'), false); // limite atingido
});

test('12. perícia de outro povo é rejeitada', () => {
  const r = F.validateCharacterCreation(valido({ per: ['Atletismo', 'Religião'] }));
  assert.ok(codes(r).includes('PER_OUTRO_POVO'));
  const w = valido({ per: ['Atletismo'] });
  assert.equal(F.togglePericia(w, 'Religião'), false);
});

test('13. habilidade racial inválida, ausente ou múltipla é rejeitada', () => {
  assert.ok(codes(F.validateCharacterCreation(valido({ hab: 'Passos Arcanos' }))).includes('HAB_OUTRO_POVO'));
  assert.ok(codes(F.validateCharacterCreation(valido({ hab: '' }))).includes('HAB_AUSENTE'));
  assert.ok(codes(F.validateCharacterCreation(valido({ hab: ['Leitura Social', 'Resistência Adaptativa'] }))).includes('HAB_MULTIPLAS'));
  assert.ok(codes(F.validateCharacterCreation(valido({ hab: 'Voo Dracônico' }))).includes('HAB_OUTRO_POVO'));
});

test('14. origem inexistente é rejeitada; as 17 do livro são aceitas', () => {
  assert.ok(codes(F.validateCharacterCreation(valido({ origem: 'Bárbaro' }))).includes('ORI_INEXISTENTE'));
  assert.ok(codes(F.validateCharacterCreation(valido({ origem: '' }))).includes('ORI_AUSENTE'));
  assert.equal(F.ORI.length, 17);
  for (const o of F.ORI) assert.equal(F.validateCharacterCreation(valido({ origem: o })).ok, true, o);
});

test('15. ficha incompleta não pode ser finalizada (mk lança erro com a lista)', () => {
  const w = F.newW();
  const r = F.validateCharacterCreation(w);
  assert.equal(r.ok, false);
  const etapas = new Set(r.erros.map(e => e.etapa));
  for (const s of [0, 1, 4, 5]) assert.ok(etapas.has(s), 'etapa ' + s);
  assert.throws(() => F.mk(w), e => Array.isArray(e.erros) && e.erros.length === r.erros.length);
  // estado adulterado após "avançar" pelas telas também é barrado
  const w2 = valido(); w2.a.int = 4; w2.a.for = 0;
  assert.equal(F.validateCharacterCreation(w2).ok, false);
});

test('identidade: sem idade mínima universal; idade precisa ser inteira', () => {
  assert.equal(F.validateCharacterCreation(valido({ idade: 12 })).ok, true);
  assert.equal(F.validateCharacterCreation(valido({ idade: 0 })).ok, true);
  assert.ok(codes(F.validateCharacterCreation(valido({ idade: '' }))).includes('IDADE_AUSENTE'));
  assert.ok(codes(F.validateCharacterCreation(valido({ idade: 17.5 }))).includes('IDADE_INVALIDA'));
  assert.ok(codes(F.validateCharacterCreation(valido({ nome: '   ' }))).includes('NOME_AUSENTE'));
  assert.ok(codes(F.validateCharacterCreation(valido({ povo: 'Elfo' }))).includes('POVO_INEXISTENTE'));
});

test('ficha gerada: sem benefícios não documentados e habilidade sem duplicação', () => {
  const w = valido();
  w.narr = { conceito: 'Cadete', aparencia: 'Alta', historia: 'Linha 1\n\n<b>Linha 2</b>', objetivos: 'Ser escolhida', obs: '' };
  const c = F.mk(w);
  assert.equal(c.nucleo, '');                         // núcleo não é fixado automaticamente
  eq([...c.money], [0, 0, 0]);
  assert.equal(c.bag.length, 0); assert.equal(c.magias.length, 0); assert.equal(c.cin, ''); assert.equal(c.eq, '');
  eq({ ...c.sk }, { Atletismo: 2, Natureza: 2 }); // só as raciais, em Apto
  assert.equal(c.habs.filter(x => x.cat === 'Habilidade racial').length, 1);
  assert.equal(c.habs[0].nome, 'Leitura Social');
  assert.match(c.habs[0].efe, /sinais de mentira/);
  assert.equal(c.manaMax, 17); assert.equal(c.mana, 17); assert.equal(c.mana0.base, 15); eq(c.mana0.rol, [3, 3, 3, 3, 3]);
  assert.equal(c.narr.conceito, 'Cadete');
  assert.equal(c.hist.html, '<p>Linha 1</p><p>&lt;b&gt;Linha 2&lt;/b&gt;</p>'); // texto escapado
  for (const k of ['nivel', 'classe', 'pv', 'proficiencia', 'dragao']) assert.equal(k in c, false, k);
});

test('16. salvar e recarregar ficha válida preserva tudo', () => {
  const env = load();
  const w = Object.assign(env.get('newW')(), { nome: 'Ravi', idade: 20, povo: 'Sáelios', origem: 'Erudito', hab: 'Passos Arcanos', a: { for: 1, des: 2, cor: 3, car: 0, int: 3 }, per: ['História', 'Religião', 'Controle de Mana'] });
  env.get('rolarMana')(w, () => 4); env.get('manterMana')(w);
  const c = env.get('mk')(w);
  env.ctx.__c = c;
  vm.runInContext('S.chars=[__c]; save()', env.ctx);
  const raw = env.mem['sodual.v1'];
  assert.ok(raw);
  const env2 = load({ 'sodual.v1': raw });
  const back = env2.get('S').chars[0];
  assert.equal(back.nome, 'Ravi');
  assert.equal(back.manaMax, 27);
  eq(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(c)));
  assert.equal(env2.get('S').v, 3);
});

test('17. dados e backups anteriores (v1/v2) são migrados sem perda', () => {
  const v2 = {
    v: 2,
    chars: [{ id: 'abc', nome: 'Antiga', idade: 19, povo: 'Dárnios', origem: 'Caçador', a: { for: 2, des: 2, cor: 2, car: 2, int: 1 }, manaMax: 13, mana: 7, nucleo: 'Vermelho Escuro', sk: { Natureza: 3 }, hab: 'Mãos Firmes',
      hist: { t: 'Origens', html: '<p>Era uma vez</p>' }, bag: [{ id: 'i1', nome: 'Faca', qtd: 1, cat: 'Arma' }], magias: [{ id: 'm1', nome: 'Luz' }], habs: [{ id: 'h1', nome: 'Mãos Firmes', cat: 'Habilidade racial' }], w: {}, money: [5, 2, 1], notes: 'nota', cin: 'Cinete X' }],
    net: { pos: { abc: [1, 2] }, edges: [{ a: 'abc', b: 'p1' }], people: [{ id: 'p1', nome: 'Amigo' }] },
    set: { col: 1, theme: 'light', ac: '#1aa6c9', nome: 'Jogador', img: '' }
  };
  const raw = JSON.stringify(v2);
  const env = load({ 'sodual.v1': raw });
  const S = JSON.parse(JSON.stringify(env.get('S')));
  const c = S.chars[0];
  assert.equal(c.manaMax, 13);   // reserva antiga NÃO é recalculada
  assert.equal(c.mana, 7);
  assert.equal(c.nucleo, 'Vermelho Escuro');
  assert.equal(c.hist.html, '<p>Era uma vez</p>');
  assert.equal(c.bag[0].nome, 'Faca'); assert.equal(c.magias[0].nome, 'Luz'); assert.equal(c.habs.length, 1);
  eq(c.money, [5, 2, 1]); assert.equal(c.cin, 'Cinete X'); eq(c.sk, { Natureza: 3 });
  eq(c.narr, { conceito: '', aparencia: '', objetivos: '', obs: '' });
  eq(S.net, v2.net); eq(S.set, v2.set);
  assert.equal(S.v, 3);
  assert.equal(env.mem['sodual.v1.bak'], raw);  // cópia da versão anterior guardada antes de migrar
  // narr pré-existente (inclusive chaves desconhecidas) é preservado
  const n = env.get('norm')({ v: 3, chars: [{ ...v2.chars[0], narr: { conceito: 'X', extra: 'Y' } }] });
  assert.equal(n.chars[0].narr.conceito, 'X'); assert.equal(n.chars[0].narr.extra, 'Y');
  // backup v1 sem campo v e com várias fichas: extras viram pessoas da rede
  const v1 = { chars: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }] };
  const n1 = env.get('norm')(JSON.parse(JSON.stringify(v1)));
  assert.equal(n1.chars.length, 1); assert.ok(n1.net.people.some(p => p.id === 'b'));
  // exportação de ficha usa a versão atual e é lida de volta pela mesma normalização
  const exp = JSON.parse(JSON.stringify({ v: env.get('VER'), chars: [c], net: { pos: {}, edges: [], people: [] } }));
  assert.equal(env.get('norm')(exp).chars[0].manaMax, 13);
});

test('dados oficiais: listas raciais e habilidades conferem com o cap. 16', () => {
  const PV = F.PV;
  eq([...PV['Sáelios'].per], ['Controle de Mana', 'História', 'Investigação', 'Intuição', 'Percepção', 'Religião', 'Medicina']);
  eq([...PV.Arveni.per], ['Atletismo', 'Acrobacia', 'Persuasão', 'Intuição', 'Medicina', 'Natureza', 'Montaria']);
  eq([...PV['Dárnios'].per], ['Atletismo', 'Prestidigitação', 'Intimidação', 'Medicina', 'Natureza', 'Trato com Criaturas', 'Percepção']);
  eq(PV['Sáelios'].hab.map(x => x[0]), ['Sensibilidade Mágica', 'Afinidade Arcana', 'Percepção do Fluxo', 'Passos Arcanos']);
  eq(PV.Arveni.hab.map(x => x[0]), ['Reflexos Condicionados', 'Resistência Adaptativa', 'Leitura Social']);
  eq(PV['Dárnios'].hab.map(x => x[0]), ['Estrutura Robusta', 'Mãos Firmes', 'Firmeza Dárnia']);
  assert.match(PV['Dárnios'].hab[2][1], /^Uma vez por cena/);
  assert.match(PV['Sáelios'].hab[1][1], /^Uma vez por cena/);
});
