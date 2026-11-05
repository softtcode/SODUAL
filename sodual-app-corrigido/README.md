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
`src/rules.js` dados do livro, estado e migração · `src/creation.js` regras de criação, cálculo de mana e validação global (sem DOM) · `src/ui.js` assistente de criação e ficha · `src/lore.js` conteúdo · `src/imagem.js` editor de enquadramento de imagens · `src/personagem.js` perfil, História, Mochila, Magias, Habilidades · `src/network.js` Rede de Conexões (SVG próprio) · `src/pages.js` Lore, Biblioteca, Config, Ajuda, Livro · `src/auth.js` login, cadastro, recuperação, sessão e dados por conta · `src/app.js` layout/sidebar · `config.example.js` modelo da configuração pública · `tools/gen_config.mjs` gera `config.js` a partir do ambiente · `assets/livro.pdf` livro incluído · `tests/` testes automatizados.

## Criação de personagem
- Toda a validação passa por `validateCharacterCreation(rascunho)` (em `src/creation.js`), que retorna `{ok, erros:[{etapa, campo, codigo, msg}]}`. O botão "Concluir e salvar" só grava fichas válidas.
- **Reserva de mana rolada (livro + regra da mesa):** Sáelios 4D4, Arveni 3D4, Dárnios 2D4, + Corpo (regra atual; antes eram 6D4, 5D4 e 4D4). Até 3 rolagens (`rolarMana`); cada nova descarta a anterior para sempre, e a terceira é definitiva. "Manter resultado" (`manterMana`) encerra as rolagens. Depois da 1ª rolagem o povo fica travado; mudar Corpo só recalcula o total (`calcManaInicial(rascunho)`).
- O rascunho da criação fica salvo na conta (`S.wiz`): tentativas e resultado sobrevivem a recarregar a página e a sair da criação. É apagado ao salvar a ficha.
- Rascunhos de criação rolados com a quantidade antiga de dados guardam essa rolagem em `mrAntiga` e pedem nova rolagem. Fichas antigas mantêm a reserva registrada (inclusive as da regra anterior, `mana0.regra = 'dados-no-maximo'`); nada é rolado nem recalculado na migração.

## Combate e núcleo (src/rules.js)
- **Posturas:** `setPostura`, `setPesada`, `posturasPermitidas`, `post` (efetiva). Arma pesada só permite Ofensiva; ao marcá-la, a postura vira Ofensiva, e ao desmarcar nada é restaurado. Fichas salvas com arma pesada e outra postura são corrigidas ao carregar.
- **Ataque:** a postura Ofensiva dá +2 (`ATK_POS`, `atkPostura`, `atkMod`), aplicado só no cálculo; perícias e atributos não mudam.
- **Ferimentos:** tudo em `wound(c, r, g, d4?)`, que devolve o evento registrado. Cada região tem estado próprio (`c.w[r]`: `g` grau, `h` contador rumo ao próximo grau, `cnt[g]` ferimentos recebidos por grau, `amp` 0 Íntegro / 1 Amputado, `log`). Só um ferimento **do mesmo grau** do estado atual avança o contador. Regra geral: dois graus iguais formam o seguinte (Leve + Leve = Intermediário … Grave + Grave = Fatal). Exceção nos braços e pernas: 3 Leves formam Intermediário e 3 Intermediários formam Alto; de Alto em diante também bastam 2 (`NEED`). O próprio estado conta como uma ocorrência: ao chegar a um grau, o contador já começa em 1. **Grau menor fica acumulado** em `ac[grau]` (por região): ao juntar a quantidade exigida para aquele grau (`NEED`), as ocorrências são consumidas e formam 1 ferimento do grau seguinte, que volta a contar. As conversões são sucessivas e cada ferimento é usado uma só vez (ex.: tronco Intermediário + Leve + Leve = Alto). Grau maior define o grau e já conta 1; as ocorrências do grau anterior vão para o acumulador, nada é descartado (confirmado pela mesa). Fatal é o limite: em região Fatal os ferimentos continuam acumulados, mas nenhuma conversão forma outro Fatal. "Curar" zera também os acumuladores. Fichas antigas começam com acumuladores vazios.
- **Fatal e morte:** Fatal não mata sozinho (só sinaliza condição crítica). `avaliarMorte` usa o estado **anterior** ao ferimento: morte imediata quando outra região já está Fatal e o novo ferimento é Alto ou pior. Fica em `c.dead` e `c.morte`, não dispara de novo, e nada é apagado.
- **Desmembramento:** braço/perna já Fatal e íntegro que recebe Leve ou Intermediário rola 1D4 na hora (`testaDesmembramento`). No 4, `amp = 1`. Na silhueta SVG o membro aparece só como um contorno tracejado (ausente). Cabeça e tronco nunca. Os ajustes manuais de grau não regeneram o membro. Amputação manual e as correções (desfazer amputação/morte) pedem confirmação.
- **Histórico de combate:** `c.cb` (até 200 eventos com região, grau, antes, depois, 1D4, amputação e morte), visível no Modo de Combate.
- **Compatibilidade:** `normFerimentos` só completa campos ausentes (`cnt`, `cb`, regiões faltando) e saneia valores impossíveis. Grau, contador, amputação e morte gravados não mudam.

## Imagens (perfil e personagem)
- Ao escolher uma foto abre o editor de enquadramento (`src/imagem.js`), que permite arrastar, pinçar, usar a roda do mouse, o controle de zoom e o teclado. O recorte nunca deixa área vazia. **Salvar enquadramento** é o único momento em que a imagem anterior é substituída. **Cancelar** não altera nada.
- Proporção usada: a do espaço real. Hoje os dois espaços (`.uav` no perfil, `.sh-av .av` na ficha) são círculos 1:1 (`IMG_CFG`).
- Armazenamento: continua no `localStorage` da conta. `img` é o recorte pronto (JPEG de até ~90 KB, usado por todas as telas como antes). `imgSrc` é a original reduzida (lado ≤ 1280 px, até ~240 KB), para reajustar depois. `imgCrop` = `{x, y, z}`. Se faltar espaço, só o recorte é salvo. Fotos antigas (só `img`) podem ser reajustadas a partir do próprio recorte.
- **Futuro Supabase Storage:** crie um bucket **privado** (ex.: `avatars`) com políticas RLS que limitem leitura e escrita ao dono (`auth.uid()` no caminho `uid/arquivo`), envie o recorte e a original pelo supabase-js com a sessão do usuário, guarde só os caminhos e o `imgCrop` na ficha e exiba com URLs assinadas. Não use bucket público nem chave de serviço no front-end.
- **Núcleo:** Preto, Vermelho Escuro, Vermelho Sólido, Vermelho Claro, Laranja Escuro, Laranja Sólido, Laranja Claro, Amarelo Escuro, Amarelo Sólido, Amarelo Claro, Prata Escura, Prata Sólida, Prata Clara, Branco (`NUC`, `setNucleo`). Toda ficha nova começa em Preto (`NUC_INI`); fichas antigas sem estágio continuam como estavam. O antigo "Laranja" é preservado e sinalizado na ficha até o jogador escolher o tom; nunca é convertido automaticamente.

## Testes
Requer Node 18+ (sem dependências):

```
node --test "tests/*.test.mjs"
```

## Pontos que dependem do autor
- Pacotes mecânicos das origens (perícias, arma, habilidade, dinheiro, equipamentos): não publicados; `ORI_PER` em `rules.js` fica vazio e nada é concedido.

## Limitações conhecidas
Rede feita em SVG próprio (não React Flow); ícones Lucide embutidos como SVG; sem React Router/Hook Form/Zod/Recharts; editor de História usa `contentEditable`; o PDF no visualizador nativo não aceita scrollbar customizada; na versão de arquivo único o PDF deve ser aberto manualmente.
