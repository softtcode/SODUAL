// Céu da Rede de Conexões (src/network.js): estrelas discretas, poucas cintilando e nenhuma do tamanho de um avatar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ IC: {}, h: () => null, React: {}, console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'network.js'), 'utf8') + ';this.__S=STARS;this.__N=NEB;', ctx);
const S = ctx.__S;

test('estrelas: ~80% minúsculas, ~15% pequenas, ~5% de destaque; nenhuma grande', () => {
  const n = S.length, k = [0, 1, 2].map(t => S.filter(s => s.k === t).length / n);
  assert.ok(n > 200 && n < 300, 'quantidade moderada: ' + n);
  assert.ok(k[0] > .72 && k[0] < .88, 'minúsculas ' + k[0]);
  assert.ok(k[1] > .09 && k[1] < .21, 'pequenas ' + k[1]);
  assert.ok(k[2] > .01 && k[2] < .09, 'destaque ' + k[2]);
  assert.ok(Math.max(...S.map(s => s.r)) <= 1.5, 'raio máximo 1,5 (avatares têm 24–30)');
  assert.ok(S.filter(s => s.k === 0).every(s => s.op <= .55 && s.r <= .7), 'camada de fundo apagada');
});

test('estrelas: poucas cintilam (nenhuma das minúsculas) e a distribuição cobre todo o céu sem aglomerados', () => {
  const tw = S.filter(s => s.tw);
  assert.ok(tw.length > 0 && tw.length <= 25, 'cintilando: ' + tw.length);
  assert.ok(tw.every(s => s.k > 0));
  const cel = new Set(S.map(s => Math.floor(s.x / 100) + ':' + Math.floor(s.y / 100)));
  assert.equal(cel.size, 70, 'todas as 10×7 regiões do céu têm estrelas');
  assert.ok(S.every(s => s.x >= 0 && s.x <= 1000 && s.y >= 0 && s.y <= 700));
});

test('nebulosas: só gradientes de baixa opacidade (sem filtro de desfoque)', () => {
  assert.ok(ctx.__N.every(n => n.o <= .2));
  assert.ok(!/feGaussianBlur/.test(fs.readFileSync(path.join(ROOT, 'src', 'network.js'), 'utf8')));
});
