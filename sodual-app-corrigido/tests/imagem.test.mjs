// Testes da matemática do enquadramento (sem DOM) — execute com:  node --test "tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'imagem.js'), 'utf8'), ctx, { filename: 'imagem.js' });
const F = new Proxy({}, { get: (_, k) => vm.runInContext(k, ctx) });
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} ≈ ${b}`);
/* O recorte precisa estar sempre inteiro dentro da imagem e com a proporção pedida (sem áreas vazias nem distorção). */
function dentro(r, iw, ih, asp, m) {
  assert.ok(r.sx >= -1e-6 && r.sy >= -1e-6, m + ': origem negativa');
  assert.ok(r.sx + r.sw <= iw + 1e-6 && r.sy + r.sh <= ih + 1e-6, m + ': passa da borda');
  near(r.sw / r.sh, asp, m + ': proporção');
}

test('zoom 1 preenche o quadro com o maior recorte possível, centralizado', () => {
  const r = F.cropRect({ x: .5, y: .5, z: 1 }, 1600, 900, 1);
  assert.deepEqual({ ...r }, { sx: 350, sy: 0, sw: 900, sh: 900 });
  const v = F.cropRect({ x: .5, y: .5, z: 1 }, 600, 1200, 3 / 4);
  near(v.sw, 600, 'retrato'); near(v.sh, 800, 'retrato');
});

test('arrastar e zoom nunca deixam áreas vazias', () => {
  for (const [iw, ih, asp] of [[1600, 900, 1], [600, 1200, 1], [500, 500, 1], [1200, 800, 3 / 4], [800, 1200, 16 / 9]]) {
    let s = { x: .5, y: .5, z: 1 };
    s = F.cropPan(s, 99999, 99999, iw, ih, asp, 300); dentro(F.cropRect(s, iw, ih, asp), iw, ih, asp, 'canto 1');
    s = F.cropPan(s, -99999, -99999, iw, ih, asp, 300); dentro(F.cropRect(s, iw, ih, asp), iw, ih, asp, 'canto 2');
    s = F.cropZoom(s, 3, 0, 0, iw, ih, asp); dentro(F.cropRect(s, iw, ih, asp), iw, ih, asp, 'zoom');
    s = F.cropZoom(s, .2, 1, 1, iw, ih, asp); assert.equal(s.z, 1); dentro(F.cropRect(s, iw, ih, asp), iw, ih, asp, 'zoom mínimo');
    s = F.cropZoom(s, 50, .5, .5, iw, ih, asp); assert.equal(s.z, F.IMG_ZMAX);
  }
});

test('zoom mantém fixo o ponto sob o dedo/cursor', () => {
  const iw = 2000, ih = 2000, asp = 1, W = 300, s0 = { x: .5, y: .5, z: 2 };
  const v0 = F.cropView(s0, iw, ih, asp, W), px = W * .25, src0 = (px - v0.l) / v0.k;
  const s1 = F.cropZoom(s0, 3, .25, .5, iw, ih, asp), v1 = F.cropView(s1, iw, ih, asp, W);
  near((px - v1.l) / v1.k, src0, 'ponto fixo');
});

test('arrastar move a imagem na direção do gesto', () => {
  const s = F.cropPan({ x: .5, y: .5, z: 2 }, 30, 0, 1000, 1000, 1, 300);
  assert.ok(s.x < .5);                                  // arrastar para a direita revela o lado esquerdo
  const v0 = F.cropView({ x: .5, y: .5, z: 2 }, 1000, 1000, 1, 300), v1 = F.cropView(s, 1000, 1000, 1, 300);
  near(v1.l - v0.l, 30, 'deslocamento na tela');
});

test('parâmetros inválidos são saneados', () => {
  const s = F.cropClamp({ x: 'a', y: NaN, z: -3 }, 800, 600, 1);
  assert.deepEqual({ ...s }, { x: .5, y: .5, z: 1 });
  assert.equal(F.IMG_CFG.perfil.asp, 1); assert.equal(F.IMG_CFG.retrato.asp, 1);
});
