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
**Link de e-mail abre outra versão do site?** O app sempre pede que o link volte ao endereço em que o site está aberto (`redir()` em `src/auth.js`). Se o link abrir outro endereço, a causa está no painel ou no modelo do e-mail:
- O endereço atual não está em **Redirect URLs**. Nesse caso o Supabase descarta o pedido e usa a **Site URL**. Para testar no seu computador, inclua `http://localhost:5173/**`.
- A **Site URL** aponta para um deploy antigo. Ela deve ser a produção atual.
- O modelo do e-mail (*Authentication → Emails*) usa `{{ .SiteURL }}`. Deve usar `{{ .ConfirmationURL }}`, que respeita o endereço pedido.
- O site publicado na Vercel ainda não recebeu as mudanças. Ele só muda com commit, push e deploy.

Para conferir, no e-mail recebido copie o link e veja o parâmetro `redirect_to=`: ele deve ser o endereço em que você pediu a redefinição.

4. *Emails*: o SMTP embutido do Supabase tem limite baixo de envios por hora e serve só para testes. Para produção, configure SMTP próprio (*Authentication → Emails → SMTP Settings*) e traduza os modelos de **Confirm signup** e **Reset password** (podem continuar usando `{{ .ConfirmationURL }}`).

**"Muitas tentativas" / "limite de envio de e-mails"?** O limite é do servidor, não do app. Há três limites diferentes:
- **E-mails por hora, somando o projeto inteiro.** Com o SMTP embutido do Supabase, o limite é muito baixo e não pode ser aumentado. Por isso testadores esbarram nele mesmo pedindo poucos e-mails. A solução é configurar SMTP próprio (Resend, Brevo, SendGrid, Amazon SES etc.) em *Authentication → Emails → SMTP Settings* e depois aumentar **Rate limit for sending emails** em *Authentication → Rate Limits*.
- **Intervalo entre dois e-mails para o mesmo endereço** (padrão de 60 s, em *Authentication → Rate Limits*). O app mostra uma contagem regressiva no botão.
- **Pedidos por endereço IP** (login, cadastro, verificação) também ficam em *Authentication → Rate Limits*. Testadores na mesma rede compartilham o IP.

Não desligue esses limites: eles protegem a conta dos jogadores contra força bruta e contra spam usando o seu domínio.

### Fichas e contas
- Cada conta lê e grava só a sua chave `sodual.v1.u.<id>`. Sem sessão, nada é gravado.
- As fichas de **antes do login** (chave antiga `sodual.v1`) nunca são apagadas nem alteradas. No primeiro acesso de uma conta sem fichas, o app oferece **copiá-las** para essa conta (também disponível em Configurações). Depois da cópia, a oferta some para as demais contas do navegador (`sodual.v1.dono`), evitando que um segundo jogador veja as fichas do primeiro. Quem recusa recebe a oferta de novo em Configurações.
- Ainda não há sincronização com o banco; as fichas continuam só neste navegador.

### Última conta, sair, esquecer, excluir
- **Última conta** (`sodual.ultima`): guarda só id, e-mail e nome de exibição para a tela "Bem-vindo de volta". Não guarda senha nem token e não faz login sozinha: "Entrar novamente" sempre pede a senha.
- **Sair da conta** (Perfil e Configurações): `signOut({scope:'local'})` encerra a sessão só neste navegador; as fichas ficam.
- **Esquecer conta** (tela de login): remove apenas a sugestão de última conta deste navegador (e encerra a sessão, se houver). Não exclui a conta no Supabase nem fichas, e não afeta outros dispositivos.
- **Excluir conta**: não existe no app. Exige a chave de serviço, então deve ser feito pelo painel do Supabase (*Authentication → Users*) ou por uma função de servidor futura.

## Landing page, favicon e aparência
- **Landing page pública** (`src/landing.js`): é a primeira tela de quem chega sem sessão. "Começar minha jornada" e "Entrar no Sodual" levam ao login/cadastro já existente (`#entrar`). Usa o mesmo `Gate` de `src/auth.js`, sem outro sistema de autenticação.
  - Com sessão válida, o app abre direto. `#apresentacao` mostra a landing a qualquer pessoa sem encerrar a sessão; há um link em Ajuda e outro na tela de login.
  - Após "Sair da conta", em links de e-mail com erro e quando há "última conta" no navegador, a tela inicial continua sendo o login.
  - Textos baseados no Livro I e em `src/lore.js`. As imagens ficam em `LAND_ART`: por enquanto o dragão da tela de login e as ilustrações da lore. Para trocar pelas artes definitivas, basta mudar os caminhos.
- **Favicon:** `favicon.ico` na raiz (16 a 256 px, fundo transparente), referenciado em `index.html` como `favicon.ico?v=3`. Ao trocar o arquivo, aumente o `?v=` para furar o cache. O `vercel.json` manda revalidar `/favicon.ico`, e o `sodual-single.html` leva o ícone embutido.
- **Aparência:** tema e cor de destaque ficam em Configurações › Aparência (valores em `S.set.theme` e `S.set.ac`, aplicados na hora por `applySet`).

## Salvamento na nuvem — Entrega 5 (imagens no Storage privado)
**Como funciona** (`src/imagens-nuvem.js`, `syncCargaStr` em `src/sync.js`)
- Imagens do jogador: foto de perfil (`S.set.img`/`imgSrc`), retrato (`chars[].img`/`imgSrc`) e fotos da rede (`net.people[].img`).
- Ficam no bucket **privado** `sodual-images`, em `<uid>/profile/avatar/<sha>.jpg`, `<uid>/characters/<id>/<sha>.jpg` e `<uid>/network/<id>/<sha>.jpg`. O nome do arquivo é o SHA-256 do conteúdo: seguro, único e sem sobrescrita.
- **Neste dispositivo** a imagem continua em base64 (cache local). O app funciona offline, e o editor de enquadramento e o `imgCrop` não mudaram.
- **Envio**, em segundo plano e só com a sincronização ativa (nunca em "migrar", "só neste dispositivo" ou conflito):
  1. Valida formato (JPEG, PNG ou WebP) e tamanho (≤ 1 MB).
  2. Envia sem sobrescrever.
  3. Só depois da confirmação do Storage grava a referência `imgRef`/`imgSrcRef = {p: caminho, h: impressão}`.
  4. Só a partir daí o JSON da nuvem leva a referência no lugar do base64.
- **Falha no envio:** nada se perde. A imagem local fica intacta, o JSON continua com o base64 (como antes da Entrega 5), a pendência aparece em Configurações › Sincronização › Imagens e há novas tentativas automáticas e o botão "Tentar novamente".
- **Outro dispositivo:** recebe o JSON com referências, pede uma **URL assinada** (1 h, só em memória, renovada quando vence), baixa, confere a impressão e guarda o base64 localmente. Isso não gera pendência nem reenvio.
- **Segurança das referências:** nunca se grava URL assinada no JSON, só caminhos. Uma referência só vale se o caminho estiver na pasta da conta atual e a impressão bater com a imagem local. Uma referência de outra conta (ex.: backup alheio) é descartada, e o base64 local é enviado.
- **Imagens antigas** (base64 de antes da Entrega 5) migram sozinhas depois que a conta sincroniza, sem apagar nada antes da confirmação.
- **Backup portátil:** "Exportar backup", as cópias guardadas e a tela de conflito exportam com todas as imagens em base64 (do cache ou baixadas na hora) e **sem** caminhos privados. Se alguma imagem não puder ser baixada (sem conexão), o aviso diz quantas ficaram de fora.

**Configuração manual (Supabase)**
1. Rode `supabase/migrations/002_images_storage.sql` no SQL Editor. Ele cria ou corrige o bucket privado (1 MB, JPEG/PNG/WebP) e as 4 políticas em `storage.objects`. Pode ser rodado de novo e não apaga nada.
2. Rode `supabase/tests/002_images_storage_test.sql`. O esperado é "SODUAL: TODAS AS VERIFICAÇÕES DO STORAGE PASSARAM". Ele termina em `ROLLBACK`.
3. Em *Storage*, confira que `sodual-images` aparece **sem** o selo "Public".
4. Teste local do SQL (opcional, sem Supabase): `node supabase/tests/run_local.mjs .` com `PGLITE_DIR` (ver o arquivo). Valida as migrações 001 e 002, a idempotência e se o teste apanha sabotagens.

**Como testar com o app**
- **Upload:** entre, troque a foto de perfil e espere "Todas as imagens estão na nuvem" em Configurações › Sincronização. No painel, *Storage › sodual-images › <seu uid>* mostra o arquivo.
- **Recuperação:** abra a mesma conta em outro navegador ou janela anônima. A foto aparece depois de baixada.
- **Isolamento:** com outra conta, as imagens da primeira não aparecem. Uma URL assinada copiada de um navegador expira em 1 h.
- **Falha:** com o DevTools em *Offline*, troque a foto. "Imagens: 1 aguardando envio", a foto continua na tela e volta a subir quando a conexão volta.

**Limitações conhecidas**
- Imagens substituídas ou removidas continuam no Storage (não há limpeza automática). Apagar arquivos que outro dispositivo ou uma cópia guardada ainda usam quebraria essas referências. Uma limpeza segura de órfãos fica para uma entrega futura.
- "Excluir dados da nuvem" apaga só o JSON. As imagens ficam no Storage da conta até essa limpeza existir.
- O envio exige `crypto.subtle`, que os navegadores só oferecem em contexto seguro (HTTPS ou localhost). Sem ele, a seção Imagens avisa, e as imagens continuam no JSON como antes.

## Salvamento na nuvem — Entrega 4 (interface)
- **Indicador:**
  - Estados: "Salvo na nuvem" (só após a confirmação do servidor), "Salvando…", "Salvo neste dispositivo", "Só neste dispositivo", "Conflito detectado" e "Falha na sincronização".
  - No desktop fica no rodapé da barra lateral (só o ícone quando ela está recolhida). A dica mostra a última sincronização confirmada ("há 2 min") e se há alterações aguardando envio.
  - No celular, o estado completo fica no painel "Mais", com a última confirmação ou o motivo da falha. O botão "Mais" ganha um sinal só quando há algo que pede atenção.
  - Clicar no indicador abre a escolha de versão (em conflito) ou Configurações › Sincronização.
- **Avisos:** só nas mudanças de estado, nunca a cada salvamento: queda de conexão, volta da conexão, sessão a renovar, dados acima do limite e falha.
- **Ajuda:** tópicos "Onde ficam suas fichas" e "Conflitos, cópias e exclusão".

## Salvamento na nuvem — Entrega 3 (migração e conflitos)
- **Conflito** (revisões diferentes, os dois lados mudaram, ou a nuvem foi apagada por outro dispositivo): a tela "Escolha qual versão manter" abre sozinha. Também abre pelo indicador ou em Configurações › Sincronização.
  - Mostra as duas versões lado a lado: personagem, mana, núcleo, rede, eventos de combate, data, dispositivo e revisão da nuvem.
  - Deste dispositivo, mostra a última alteração local e a última sincronização. Dados antigos sem esse registro aparecem como "sem registro de data"; nenhuma data é inventada.
  - **Exportar as duas versões** baixa dois JSON.
  - **Manter versão da nuvem** (`syncManterNuvem`) e **Manter versão deste dispositivo** (`syncManterDispositivo(revisão vista)`) pedem confirmação.
  - A segunda grava sobre a revisão que o jogador viu. Se outro dispositivo mudar a nuvem enquanto a tela está aberta, a gravação é recusada, a tela recarrega com a versão nova e pede nova escolha.
  - "Decidir depois" mantém tudo local.
- **Cópias de segurança** neste navegador (Configurações › Sincronização › Cópias guardadas, com Exportar, Restaurar e Apagar cópia):
  - `.antes-nuvem`: o dispositivo antes de adotar a nuvem.
  - `.nuvem-substituida`: a nuvem antes de ser trocada pela versão do dispositivo.
  - `.nuvem-excluida`: a nuvem no momento da exclusão.

  Cada espaço guarda **a cópia mais recente daquele tipo**.
- **Excluir dados da nuvem** (Zona de risco, digitando EXCLUIR): `sodual_sync_delete` com a revisão atual. Não exclui a conta nem os dados do dispositivo. Depois disso, o dispositivo fica em "Só neste dispositivo" e nada é reenviado sem pedido; no próximo acesso, o app pergunta de novo. Outros dispositivos recebem "conflito: dados removidos da nuvem" e não recriam a nuvem sozinhos.
- **Limpar este dispositivo** continua separado: apaga só a cópia local, as cópias guardadas e os metadados.
- **Migração** (dispositivo com dados, nuvem vazia): exige "Enviar para a nuvem", e só conta como concluída depois da confirmação do servidor. A importação de dados de antes do login (`importLegacy`) continua dependendo do botão "Usar nesta conta"; a chave `sodual.v1` nunca é apagada.
- **Restaurar backup:** grava localmente e segue a sincronização com controle de revisão. Se a nuvem for mais nova, vira conflito e nada é sobrescrito.

## Salvamento na nuvem — Entrega 2 (sincronização dos dados JSON)
`src/sync.js` (carregado antes de `auth.js`). O app é **local-first**: `save()` grava na hora no localStorage e só então chama `syncMarcar()`. O envio acontece em segundo plano.
- **Envio:** com debounce (`SYNC_CFG.debounce`, 1,2 s), uma requisição por vez, com snapshot imutável e a revisão esperada (`sodual_sync_put`). Se houver edições durante um envio, sai um novo envio depois. Nunca se cria um registro vazio.
- **Metadados por conta** (`LS+'.sync'`): `{rev, hash, at}` = última revisão confirmada, impressão do estado correspondente e data. "Pendente" = o estado atual difere de `hash`.
- **Decisão inicial** (`syncDecidir`), feita antes de qualquer envio:

  | Situação | Ação |
  |---|---|
  | nuvem vazia e dispositivo sem conteúdo | espera o primeiro conteúdo (`vazio`) |
  | nuvem vazia e dispositivo com dados | **pergunta** antes de enviar (`migrar`) |
  | conteúdo igual | nada é enviado (`igual`) |
  | só a nuvem mudou, ou dispositivo vazio | carrega da nuvem e guarda o local anterior em `LS+'.antes-nuvem'` (`adotar`) |
  | só o dispositivo mudou | envia (`enviar`) |
  | os dois mudaram | **para em `conflito`** sem gravar nada |
  | nuvem apagada por outro dispositivo | **para em `conflito`** sem gravar nada |

- **Login (`Gate`):** depois da sessão confirmada → `openAccount` (cache local) → `syncIniciar`. Sem dados locais, mostra "Buscando suas fichas na nuvem…" até a resposta (máximo 8 s). Com dados locais, abre na hora e concilia em segundo plano.
- **Logout:** `sair()` tenta enviar o pendente por até 2,5 s. Depois, `syncEncerrar()` invalida a sessão (número de geração `SY.tok`): respostas atrasadas são descartadas e nunca alteram outra conta. O que não subiu continua no dispositivo e é enviado no próximo login dessa conta.
- **Offline:** edições ficam locais, sem requisição a cada mudança. Há novas tentativas com backoff (2–60 s, até 8). O evento `online` e a volta à aba disparam nova tentativa, que refaz a decisão inicial. Falha de sessão (`auth`) não é tratada como rede: tenta de novo quando o token é renovado.
- **Interface:** indicador na barra lateral, pergunta de migração e Configurações › Sincronização (estado, última sincronização confirmada, pendências, "Sincronizar agora", aviso de conflito). "Limpar este dispositivo" agora também apaga `.sync` e avisa se há algo não confirmado na nuvem.
- **Limites desta entrega:**
  - Imagens ainda vão dentro do JSON (base64). Acima de ~3,9 MB o envio é bloqueado e o estado fica em `grande`, até a Entrega 5 (Storage).
  - Duas abas da mesma conta no mesmo navegador podem gerar um conflito (seguro, mas exige escolha).
- **Arquivo único** (`sodual-single.html`): sincroniza nas mesmas condições do login, ou seja, com `config.js` ao lado e servido por `http(s)://`.
- **Testes:** `tests/sync.test.mjs` (26 testes, Entregas 2 e 3; servidor falso com a mesma regra de revisão).

**Testar com duas contas / dois dispositivos (manual):**
1. Entre com a conta A num navegador, crie a ficha e espere "Salvo na nuvem".
2. Abra outro navegador (ou janela anônima), entre com A e veja a ficha chegar.
3. Edições **em sequência** não geram conflito: ao voltar à aba, o outro navegador busca a nuvem e, se não tem nada pendente, traz a versão nova sozinho ("Dados atualizados com a versão da nuvem"). Isso é o esperado.
   Para provocar um **conflito real**:
   - No navegador B, abra DevTools → Network → Offline e edite (deve aparecer "Salvo neste dispositivo").
   - No navegador A, que está online, edite outra coisa e espere "Salvo na nuvem".
   - No B, volte a ficar online. Deve aparecer "Escolha qual versão manter", e a nuvem mantém a alteração de A até a sua escolha.
   - Alternativa: dois navegadores lado a lado e visíveis, sem trocar de aba, editando os dois em poucos segundos.
4. Saia e entre com a conta B: nada de A aparece.
5. Para testar offline: DevTools → Network → Offline. Edite, veja "Salvo neste dispositivo", volte online e veja "Salvo na nuvem".

## Salvamento na nuvem — Entrega 1 (banco e segurança)
Aplicada e verificada no projeto: tabela, RLS e RPCs abaixo.
- **Tabela** `public.sodual_user_data`: `user_id` (PK, FK `auth.users` com `on delete cascade`), `data` jsonb (o objeto `S`, sem credenciais), `revision` bigint, `schema_version` int, `updated_at`, `created_at`, `updated_by_device`. Uma linha por conta.
- **RLS** ativo. O cliente (`authenticated`) só tem `SELECT` da própria linha. `anon` não tem acesso nenhum. Não existe escrita direta: `INSERT/UPDATE/DELETE` foram revogados.
- **RPCs** (`SECURITY DEFINER`, `search_path=''`, sempre `auth.uid()` do token, `EXECUTE` só para `authenticated`):
  - `sodual_sync_put(p_data, p_expected_revision, p_schema_version, p_device)`: `p_expected_revision=0` cria a linha; `N` atualiza só se a revisão atual for `N` e a eleva para `N+1`. Devolve `{ok, revision, updated_at}` ou `{ok:false, conflict:true, revision, updated_at, updated_by_device}`. Valida o formato (`chars` como lista; `set`/`net` como objetos), recusa campos de autenticação e limita o JSON a 4 MB.
  - `sodual_sync_delete(p_expected_revision)`: exclui só os dados da nuvem desta conta, com a revisão atual. Não exclui a conta nem dados locais.
- **Concorrência**: o `UPDATE ... WHERE revision = esperada` é atômico. De duas escritas com a mesma revisão, uma vence e a outra recebe conflito, sem sobrescrever. `updated_at` é só informativo.

**Aplicar (manual, no painel do Supabase):**
1. *SQL Editor* → cole `supabase/migrations/001_cloud_sync.sql` → *Run*. É não destrutiva e pode ser executada de novo.
2. *SQL Editor* → cole `supabase/tests/001_cloud_sync_test.sql` → *Run*. Deve aparecer **"SODUAL: TODAS AS VERIFICAÇÕES PASSARAM"**. O script cria dois usuários de teste e termina em `ROLLBACK`: nada fica gravado.
3. Opcional: *Table Editor* → `sodual_user_data` → confira "RLS enabled" e as 4 políticas. *Database → Functions* → `sodual_sync_put` e `sodual_sync_delete`.
4. Nenhuma chave nova no front-end: o app continua usando só a publishable/anon key.

**Validação local sem Supabase** (Postgres real em WebAssembly): ver o cabeçalho de `supabase/tests/run_local.mjs`. Ele aplica a migração, roda o teste, prova que o teste apanha sabotagens (UPDATE liberado, RLS desligado, anon com acesso, revisão removida) e testa duas escritas concorrentes.

**Rollback seguro:** revogar `EXECUTE` das duas funções desliga a escrita na nuvem sem apagar nada (comando no fim da migração). O app continua salvando localmente.

## Perfil do jogador (cosméticos)
- `S.set.perfil = {titulo, bio, moldura, banner, insignias}`, normalizado por `normPerfil` (rules.js). Fica no mesmo armazenamento local da conta que as fichas; **não há sincronização entre dispositivos** e nenhuma tabela nova no Supabase.
- Catálogos em `rules.js`: `PF_MOLD` (6 molduras), `PF_BAN` (4 banners), `PF_TIT` (5 títulos) e `PF_INS` (insígnias "livre" ou "futura", estas bloqueadas até existir regra de obtenção). Biografia: texto simples, até 160 caracteres.
- A moldura é uma camada sobre a foto, que nunca é alterada. **Arte:** preencha `arte` com o caminho do PNG/WebP transparente (sugestão: `assets/cosmeticos/molduras/<id>.png`, quadrado, com o centro vazado). Sem arte, a interface mostra uma prévia provisória identificada. Os banners "Céu Astral" e "Dragão Violeta" usam artes já existentes; "Floresta Encantada" e "Ruínas Antigas" aguardam arte (proporção ~6:1).
- **Sincronização futura (opcional):** tabela `profiles(id uuid primary key references auth.users on delete cascade, perfil jsonb not null default '{}', updated_at timestamptz default now())` com RLS `using (auth.uid() = id)` e `with check (auth.uid() = id)` para select/insert/update. Ainda não foi criada.

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
- Armazenamento local: `localStorage` da conta. `img` é o recorte pronto (JPEG de até ~90 KB, usado por todas as telas como antes). `imgSrc` é a original reduzida (lado ≤ 1280 px, até ~240 KB), para reajustar depois. `imgCrop` = `{x, y, z}`. Se faltar espaço, só o recorte é salvo. Fotos antigas (só `img`) podem ser reajustadas a partir do próprio recorte.
- Na nuvem: Storage privado, ver "Salvamento na nuvem — Entrega 5".
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
