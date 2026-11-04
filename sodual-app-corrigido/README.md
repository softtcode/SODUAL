# SODUAL — Plataforma de ficha, lore e constelação

Baseada no *Sodual Livro I – Guia do Jogador, Edição 0.3*. Nenhuma regra foi inventada; lacunas do livro estão sinalizadas na interface.

## Como usar
- Abra `index.html` (precisa de internet para carregar React/Framer Motion por CDN) **ou** `sodual-single.html` (arquivo único, `python3 tools/build_single.py`).
- Dados salvos no `localStorage` (chave `sodual.v1`, formato v3); backup em Configurações. Ao abrir dados de versão anterior, uma cópia é guardada em `sodual.v1.bak` antes da migração.

## Estrutura
`src/rules.js` dados do livro, estado e migração · `src/creation.js` regras de criação, cálculo de mana e validação global (sem DOM) · `src/ui.js` assistente de criação e ficha · `src/lore.js` conteúdo · `src/personagem.js` perfil, História, Mochila, Magias, Habilidades · `src/network.js` Rede de Conexões (SVG próprio) · `src/pages.js` Lore, Biblioteca, Config, Ajuda, Livro · `src/app.js` layout/sidebar · `assets/livro.pdf` livro incluído · `tests/` testes automatizados.

## Criação de personagem
- Toda a validação passa por `validateCharacterCreation(rascunho)` (em `src/creation.js`), que retorna `{ok, erros:[{etapa, campo, codigo, msg}]}`. O botão "Concluir e salvar" só grava fichas válidas.
- **Regra da mesa (substitui o livro):** a reserva inicial de mana não é rolada. Dados raciais no valor máximo + Corpo: Sáelios 24, Arveni 20, Dárnios 16 (+ Corpo). Função: `calcManaInicial(povo, corpo)`.
- Fichas antigas mantêm a reserva registrada; nada é recalculado na migração.

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
