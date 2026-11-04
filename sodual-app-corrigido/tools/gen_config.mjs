// Gera config.js a partir de variáveis de ambiente (usado no build da Vercel; também funciona localmente).
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_ANON_KEY), e opcionais SODUAL_SITE_URL, SODUAL_SENHA_MIN, SODUAL_SENHA_REQ
// Recusa chaves secretas: este arquivo é público no navegador.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const url = (env.SUPABASE_URL || '').trim();
const key = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  console.error('[gen_config] Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}
if (/^sb_secret_/.test(key) || /service_role/.test(Buffer.from(key.split('.')[1] || '', 'base64').toString())) {
  console.error('[gen_config] A chave informada é SECRETA (service_role/sb_secret). Use a publishable/anon key.');
  process.exit(1);
}
if (!/^https:\/\/[^/]+$/.test(url.replace(/\/$/, ''))) {
  console.error('[gen_config] SUPABASE_URL inválida (esperado https://<projeto>.supabase.co).');
  process.exit(1);
}
const cfg = {
  supabaseUrl: url.replace(/\/$/, ''),
  supabaseKey: key,
  siteUrl: (env.SODUAL_SITE_URL || '').trim(),
  senhaMin: +env.SODUAL_SENHA_MIN || 8,
  senhaReq: (env.SODUAL_SENHA_REQ || '').trim(),
};
fs.writeFileSync(path.join(ROOT, 'config.js'), '/* Gerado por tools/gen_config.mjs - nao edite. */\nwindow.SODUAL_CONFIG = ' + JSON.stringify(cfg, null, 1) + ';\n');
console.log('[gen_config] config.js gerado para', cfg.supabaseUrl);
