# Story CAT-00: Epic - Catalogo Comparavel por Unidade Base

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** comparar produtos equivalentes por `R$/kg` e `R$/L`, mesmo com marcas e tamanhos diferentes,
**para** decidir melhor o que comprar no supermercado sem fazer contas manualmente no corredor.

## Objetivo

Criar a trilha completa de comparacao por unidade base, preservando o catalogo bruto por SKU e adicionando uma camada comparavel orientada a decisao de compra.

## Cenarios (Gherkin)

### Cenario 1: camada comparavel separada do catalogo bruto
**Given** que o usuario possui produtos importados em `products` e historico em `invoice_items`
**When** a funcionalidade de catalogo comparavel estiver habilitada
**Then** o sistema deve manter o catalogo bruto por SKU intacto
**And** deve existir uma camada separada para grupos comparaveis por unidade base

### Cenario 2: calculo e persistencia de preco comparavel
**Given** um item com peso ou volume confiavel identificado
**When** a nota fiscal for importada
**Then** o sistema deve calcular e persistir o preco comparavel em `R$/kg` ou `R$/L`
**And** deve registrar a origem e a confianca da medicao usada

### Cenario 3: agrupamento sempre confirmado pelo usuario
**Given** produtos parecidos com unidade base compativel
**When** o sistema detectar possibilidade de agrupamento
**Then** ele deve apenas sugerir a associacao
**And** nunca deve agrupar automaticamente sem decisao explicita do usuario

### Cenario 4: visao comparavel no historico
**Given** grupos comparaveis com historico importado
**When** o usuario abrir a tela `Historico` no modo `Comparaveis`
**Then** a busca deve retornar grupos comparaveis
**And** a UI deve exibir ao menos `menor`, `media` e `maior` `R$/unidade-base` no periodo filtrado

### Cenario 5: referencia comparavel na lista de compras
**Given** um item da lista ligado a um grupo comparavel com referencia disponivel
**When** o usuario abrir a tela `Lista`
**Then** a UI deve mostrar a referencia comparavel do grupo
**And** itens sem comparacao disponivel devem continuar com o fallback atual usando `last_price` e, na falta dele, `estimated_price`

### Cenario 6: itens sem medida confiavel
**Given** um item sem peso ou volume confiavel
**When** a nota for processada ou a visao comparavel for consultada
**Then** o item nao deve entrar automaticamente na camada comparavel
**And** o historico bruto do item deve continuar disponivel

## Requisitos Nao Funcionais

1. Todas as novas entidades e consultas devem respeitar isolamento estrito por `user_id`.
2. O calculo comparavel deve ser deterministico para a mesma entrada.
3. A comparacao por unidade base deve suportar apenas BRL, exibido em pt-BR.
4. A UX das telas `Historico` e `Lista` deve permanecer legivel em mobile.
5. O catalogo bruto por SKU nao pode ser destruido nem mesclado automaticamente.

## Dependencias

1. `CAT-01` - Infra de unidade comparavel e parsing de embalagem.
2. `CAT-02` - Persistencia de grupos comparaveis.
3. `CAT-03` - Importacao com preco comparavel.
4. `CAT-04` - APIs de edicao de produto e grupo comparavel.
5. `CAT-05` - Sugestoes heuristicas de agrupamento.
6. `CAT-06` - Historico com visao comparavel.
7. `CAT-07` - Lista de compras com referencia comparavel.

## Riscos e Rollback

1. Risco de agrupar itens com unidade incompatavel por heuristica fraca.
2. Risco de regressao no fluxo atual de importacao e historico por SKU.
3. Risco de expor dados entre usuarios caso RLS nao seja mantido nas novas rotas e consultas.
4. Rollback deve permitir desabilitar a camada comparavel sem perder `products` e `invoice_items` originais.

## Estrategia de Validacao

1. Testes unitarios para parser de unidade e calculo por unidade base.
2. Testes de integracao para persistencia de grupos, importacao e APIs de mutacao.
3. Validacao funcional das telas `Historico` e `Lista` em desktop e mobile.
4. Verificacao explicita de casos sem medida confiavel e de agrupamentos rejeitados.

## Definition of Done

1. `CAT-01` a `CAT-07` implementadas e aprovadas.
2. Visao `Historico` exibe `menor`, `media` e `maior` `R$/unidade-base` por grupo no periodo filtrado.
3. Tela `Lista` exibe referencia comparavel quando disponivel e fallback atual quando nao houver comparacao.
4. Nenhum agrupamento automatico ocorre sem decisao explicita do usuario.
5. `npm run lint`, `npx tsc --noEmit` e `npm test` passam para a entrega completa do epic.

## Estimativa

`L` (epic multi-story)

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Entregar a infraestrutura de unidade comparavel em `CAT-01`.
- [ ] Entregar a persistencia de grupos comparaveis em `CAT-02`.
- [ ] Entregar a importacao com preco comparavel em `CAT-03`.
- [ ] Entregar as APIs de edicao de produto e grupo em `CAT-04`.
- [ ] Entregar as sugestoes heuristicas em `CAT-05`.
- [ ] Entregar a visao comparavel do historico em `CAT-06`.
- [ ] Entregar a referencia comparavel na lista em `CAT-07`.

## Dev Notes

- O fluxo atual compara produtos por `normalized_name` e `product_id`, o que nao resolve decisao de compra entre marcas e tamanhos diferentes.
- O app ja diferencia itens vendidos por peso no prompt de extracao em `app/api/extract-pdf/route.ts`.
- O catalogo bruto atual e persistido em `products`, enquanto o historico de precos vive em `invoice_items`.
- A camada comparavel deve preservar o historico bruto e acrescentar contexto para decisao no supermercado.
- Exemplo real do problema: `Creme Leite Piracanjuba 200g`, `Creme Leite Piracanjuba 1.03kg` e `Creme Leite Italac 1.030kg` precisam ser comparados por `R$/kg`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.0 | Reescrita para formato Ready com criterios testaveis, dependencias e validacao | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial do epic | River (SM) |
