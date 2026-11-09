// Testes do perfil do jogador (cosméticos) — execute com:  node --test "tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(stored = {}) {
  const mem = { ...stored };
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const document = { getElementById: () => null, querySelector: () => null };
  const ctx = vm.createContext({ localStorage, document, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'rules.js'), 'utf8'), ctx, { filename: 'rules.js' });
  return { get: e => vm.runInContext(e, ctx), mem, ctx };
}
const env = load();
const F = new Proxy({}, { get: (_, k) => env.get(k) });
const j = x => JSON.parse(JSON.stringify(x));

test('catálogos: 6 molduras, 4 banners, 5 títulos; arte ausente fica vazia (prévia provisória)', () => {
  assert.deepEqual(j(F.PF_MOLD.map(m => m.nome)), ['Dragão Violeta', 'Runas Douradas', 'Chamas Arcanas', 'Lua do Crepúsculo', 'Floresta Encantada', 'Cristais de Mana']);
  assert.ok(F.PF_MOLD.every(m => m.arte === ''));
  assert.deepEqual(j(F.PF_BAN.map(b => b.nome)), ['Céu Astral', 'Dragão Violeta', 'Floresta Encantada', 'Ruínas Antigas']);
  assert.equal(F.PF_TIT.length, 5);
});

test('normPerfil: aceita valores dos catálogos e descarta o resto sem quebrar', () => {
  const p = F.normPerfil({ titulo: 'Cronista de Sodual', bio: 'Oi', moldura: 'runas-douradas', banner: 'ruinas-antigas', insignias: ['explorador', 'mestre'] });
  assert.deepEqual(j(p), { titulo: 'Cronista de Sodual', bio: 'Oi', moldura: 'runas-douradas', banner: 'ruinas-antigas', insignias: ['explorador', 'mestre'] });
  const q = F.normPerfil({ titulo: 'Rei do Mundo', moldura: 'inexistente', banner: 7, insignias: 'x' });
  assert.deepEqual(j(q), { titulo: '', bio: '', moldura: '', banner: '', insignias: [] });
  assert.deepEqual(j(F.normPerfil(null)), { titulo: '', bio: '', moldura: '', banner: '', insignias: [] });
});

test('insígnias futuras (sem regra de obtenção) nunca ficam ativas; máximo de 3', () => {
  const p = F.normPerfil({ insignias: ['fundador', 'veterano', 'explorador', 'explorador', 'mestre'] });
  assert.deepEqual(j(p.insignias), ['explorador', 'mestre']);
  assert.ok(F.PF_INS.filter(x => x.tipo == 'futura').map(x => x.id).includes('fundador'));
});

test('biografia: texto simples, sem marcação, limitada a 160 caracteres', () => {
  const p = F.normPerfil({ bio: '<img src=x onerror=alert(1)>Olá <b>mesa</b>\u0007' + 'x'.repeat(300) });
  assert.equal(p.bio.includes('<'), false);
  assert.ok(p.bio.startsWith('Olá mesa'));
  assert.equal(p.bio.length, 160);
});

test('perfil persiste e dados antigos ganham perfil vazio sem perder nada', () => {
  const e = load({ 'sodual.v1': JSON.stringify({ v: 3, chars: [], set: { nome: 'Ana', theme: 'dark', ac: '#c23fb0', img: 'data:x', imgCrop: { x: .4, y: .5, z: 1.2 } } }) });
  const s = j(e.get('S').set);
  assert.equal(s.nome, 'Ana'); assert.equal(s.ac, '#c23fb0'); assert.equal(s.img, 'data:x'); assert.deepEqual(s.imgCrop, { x: .4, y: .5, z: 1.2 });
  assert.deepEqual(s.perfil.insignias, []);
  vm.runInContext('LS="sodual.v1.u.t";S.set.perfil=normPerfil({titulo:"Desbravador",moldura:"cristais-mana",banner:"dragao-violeta"});save()', e.ctx);
  const e2 = load(e.mem); vm.runInContext('loadS("sodual.v1.u.t")', e2.ctx);
  const p = j(e2.get('S').set.perfil);
  assert.equal(p.titulo, 'Desbravador'); assert.equal(p.moldura, 'cristais-mana'); assert.equal(p.banner, 'dragao-violeta');
});
