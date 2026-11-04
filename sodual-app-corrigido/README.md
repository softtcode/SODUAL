# SODUAL — Plataforma de ficha, lore e constelação

Baseada no *Sodual Livro I – Guia do Jogador, Edição 0.3*. Nenhuma regra foi inventada; lacunas do livro estão sinalizadas na interface.

## Como usar
- Sirva a pasta por HTTP (ex.: `npx serve .` ou a Vercel) com um `config.js` válido (ver **Autenticação**). Precisa de internet para React/Framer Motion/supabase-js por CDN e para o login.
- `sodual-single.html` (arquivo único, `python3 tools/build_single.py`) também exige login: precisa do `config.js` ao lado e de ser servido por `http(s)://` para os links de e-mail funcionarem.
- Fichas salvas no `localStorage`, **uma chave por conta**: `sodual.v1.u.<id do usuário>` (formato v3, igual ao anterior); backup em Configurações. Ao abrir dados de versão anterior, uma cópia é guardada em `<chave>.bak` antes da migração.

## Autenticação (Supabase Auth, e-mail e senha)
Tudo em `src/auth.js`; o app (`App`) só é montado depois de o Supabase confirmar uma sessão válida (componente `Gate`). Usa apenas métodos oficiais: `signInWithPassword`, `signUp`, `resend`, `resetPasswordForEmail`, `updateUser`, `signOut({scope:'local'})` e `onAuthStateChange`. A sessão é guardada e renovada pelo próprio supabase-js (chave `sodual.auth`).

### Configuração pública (`config.js`)
O app não tem bundler, então variáveis de ambiente **não** chegam sozinhas ao navegador. A configuração vem de `window.SODUAL_CONFIG`, definido em `config.js` (ignorado pelo git):
- **Local:** copie `config.example.js` para `config.js` e preencha a Project URL e a publishable key (ou a chave `anon` legada). Ou rode `SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node tools/gen_config.mjs`.
- **Vercel:** em *Settings → Environment Variables* defina `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (opcionais: `SODUAL_SITE_URL`, `SODUAL_SENHA_MIN`, `SODUAL_SENHA_REQ`). O `vercel.json` roda `node tools/gen_config.mjs` no build, que gera o `config.js`. O script recusa chaves `sb_secret_`/`service_role`.
- **Nunca** use no front-end: `service_role`, secret keys, senha do PostgreSQL. Tudo em `config.js` é público.

### Painel do Supabase (manual)
1. *Authentication → URL Configuration*: **Site URL** = URL de produção (ex.: `https://sodual.vercel.app`). **Redirect URLs**: a de produção (`https://sodual.vercel.app/**`), as de preview se usar (`https://*-<time>.vercel.app/**`) e a local (`http://localhost:5173/**`, `http://127.0.0.1:5173/**`).
2. *Authentication → Sign In / Providers → Email*: habilitado; **Confirm email** ligado (recomendado). Google e demais provedores desligados.
3. *Password requirements*: tamanho mínimo (recomendado 8) e tipos de caractere — repita os mesmos valores em `senhaMin`/`senhaReq` do `config.js` (ou `SODUAL_SENHA_MIN`/`SODUAL_SENHA_REQ`) para a lista de requisitos da tela bater com o servidor. Opcional: *Prevent use of leaked passwords*.
4. *Emails*: o SMTP embutido do Supabase tem limite baixo de envios por hora e serve só para testes. Para produção, configure SMTP próprio (*Authentication → Emails → SMTP Settings*) e traduza os modelos de **Confirm signup** e **Reset password** (podem continuar usando `{{ .ConfirmationURL }}`).

### Fichas e contas
- Cada conta lê e grava só a sua chave `sodual.v1.u.<id>`. Sem sessão, nada é gravado.
- As fichas de **antes do login** (chave antiga `sodual.v1`) nunca são apagadas nem alteradas. No primeiro acesso de uma conta sem fichas, o app oferece **copiá-las** para essa conta (também disponível em Configurações). Depois da cópia, a oferta some para as demais contas do navegador (`sodual.v1.dono`), evitando que um segundo jogador veja as fichas do primeiro. Quem recusa recebe a oferta de novo em Configurações.
- Ainda não há sincronização com o banco; as fichas continuam só neste navegador.

### Última conta, sair, esquecer, excluir
- **Última conta** (`sodual.ultima`): guarda só id, e-mail e nome de exibição para a tela "Bem-vindo de volta". Não guarda senha nem token e não faz login sozinha: "Entrar novamente" sempre pede a senha.
- **Sair da conta** (Perfil e Configurações): `signOut({scope:'local'})` encerra a sessão só neste navegador; as fichas ficam.
- **Esquecer conta** (tela de login): remove apenas a sugestão de última conta deste navegador (e encerra a sessão, se houver). Não exclui a conta no Supabase nem fichas, e não afeta outros dispositivos.
- **Excluir conta**: não existe no app. Exige a chave de serviço, então deve ser feito pelo painel do Supabase (*Authentication → Users*) ou por uma função de servidor futura.

## Estrutura
`src/rules.js` dados do livro, estado e migração · `src/creation.js` regras de criação, cálculo de mana e validação global (sem DOM) · `src/ui.js` assistente de criação e ficha · `src/lore.js` conteúdo · `src/personagem.js` perfil, História, Mochila, Magias, Habilidades · `src/network.js` Rede de Conexões (SVG próprio) · `src/pages.js` Lore, Biblioteca, Config, Ajuda, Livro · `src/auth.js` login, cadastro, recuperação, sessão e dados por conta · `src/app.js` layout/sidebar · `config.example.js` modelo da configuração pública · `tools/gen_config.mjs` gera `config.js` a partir do ambiente · `assets/livro.pdf` livro incluído · `tests/` testes automatizados.

## Criação de personagem
- Toda a validação passa por `validateCharacterCreation(rascunho)` (em `src/creation.js`), que retorna `{ok, erros:[{etapa, campo, codigo, msg}]}`. O botão "Concluir e salvar" só grava fichas válidas.
- **Reserva de mana rolada (livro + regra da mesa):** Sáelios 6D4, Arveni 5D4, Dárnios 4D4, + Corpo. Até 3 rolagens (`rolarMana`); cada nova descarta a anterior para sempre, e a terceira é definitiva. "Manter resultado" (`manterMana`) encerra as rolagens. Depois da 1ª rolagem o povo fica travado; mudar Corpo só recalcula o total (`calcManaInicial(rascunho)`).
- O rascunho da criação fica salvo na conta (`S.wiz`): tentativas e resultado sobrevivem a recarregar a página e a sair da criação. É apagado ao salvar a ficha.
- Fichas antigas mantêm a reserva registrada (inclusive as da regra anterior, `mana0.regra = 'dados-no-maximo'`); nada é rolado nem recalculado na migração.

## Combate e núcleo (src/rules.js)
- **Posturas:** `setPostura`, `setPesada`, `posturasPermitidas`, `post` (efetiva). Arma pesada só permite Ofensiva; ao marcá-la, a postura vira Ofensiva, e ao desmarcar nada é restaurado. Fichas salvas com arma pesada e outra postura são corrigidas ao carregar.
- **Ataque:** a postura Ofensiva dá +2 (`ATK_POS`, `atkPostura`, `atkMod`), aplicado só no cálculo; perícias e atributos não mudam.
- **Ferimentos:** cada região tem contador próprio (`progresso`). Um ferimento de grau maior define o grau e já conta 1 impacto rumo ao seguinte; ao agravar por impactos o contador recomeça em 0. Impactos necessários: tabela do cap. 20 (`NEED`).
- **Núcleo:** Preto, Vermelho Escuro, Vermelho Sólido, Vermelho Claro, Laranja Escuro, Laranja Sólido, Laranja Claro, Branco (`NUC`, `setNucleo`). O antigo "Laranja" é preservado e sinalizado na ficha até o jogador escolher o tom; nunca é convertido automaticamente.

## Testes
Requer Node 18+ (sem dependências):

```
node --test "tests/*.test.mjs"
```

## Pontos que dependem do autor
- Pacotes mecânicos das origens (perícias, arma, habilidade, dinheiro, equipamentos): não publicados; `ORI_PER` em `rules.js` fica vazio e nada é concedido.
- Estágio inicial do núcleo: o livro confirma a sequência (começa em Preto), mas não fixa o estágio na criação; fichas novas ficam "não registrado".

## Limitações conhecidas
Rede feita em SVG próprio (não React Flow); ícones Lucide embutidos como SVG; sem React Router/Hook Form/Zod/Recharts; editor de História usa `contentEditable`; o PDF no visualizador nativo não aceita scrollbar customizada; na versão de arquivo único o PDF deve ser aberto manualmente.
