/* Configuração PÚBLICA do Supabase para o navegador. Copie para config.js e preencha.
   Use SOMENTE a Project URL e a publishable key (sb_publishable_...) ou a chave "anon" legada.
   NUNCA coloque aqui a service_role, secret keys (sb_secret_...) nem a senha do PostgreSQL:
   tudo neste arquivo é visível para qualquer visitante do site.
   Na Vercel, este arquivo é gerado por tools/gen_config.mjs a partir das variáveis de ambiente (ver README). */
window.SODUAL_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseKey: 'sb_publishable_COLE_AQUI',
  // Opcional e só para o arquivo aberto direto do disco (file://): URL para onde os e-mails de confirmação/recuperação voltam.
  // Em http(s) os links sempre voltam ao endereço atual do app; esse endereço precisa estar em Redirect URLs no Supabase.
  siteUrl: '',
  // Devem espelhar Authentication → Sign In / Providers → Email → Password requirements no painel do Supabase.
  senhaMin: 8,
  // '' | 'letters_digits' | 'lower_upper_letters_digits' | 'lower_upper_letters_digits_symbols'
  senhaReq: ''
};
