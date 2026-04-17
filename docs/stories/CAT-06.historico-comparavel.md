# Story CAT-06: Historico com Visao Comparavel

**Status**: Ready

## Story

**Como** usuario no supermercado,
**eu quero** ver grupos comparaveis no historico com referencia em `R$/kg` e `R$/L`,
**para** decidir qual marca e embalagem comprar.

## Cenarios (Gherkin)

### Cenario 1: alternar entre produtos e comparaveis
**Given** que o usuario esta na tela `Historico`
**When** ele alternar entre os modos `Produtos` e `Comparaveis`
**Then** a tela deve alternar entre as duas visoes sem erro
**And** deve preservar o filtro de periodo atual
**And** quando nenhum filtro for escolhido, a tela deve usar por padrao os ultimos `90` dias
**And** o modo `Produtos` deve continuar retornando SKUs individuais
**And** o modo `Comparaveis` deve consultar grupos comparaveis
**And** `search`, `category` e `quickFilter` do modo `Produtos` devem permanecer com o comportamento atual
**And** o valor de `search` deve ser preservado ao alternar de modo e reaplicado sobre `display_name` no modo `Comparaveis`

### Cenario 2: listagem de grupos comparaveis
**Given** grupos comparaveis com unidade base confiavel no periodo filtrado
**When** o usuario consultar o modo `Comparaveis`
**Then** a listagem deve retornar grupos comparaveis em vez de SKUs individuais
**And** deve exibir `menor`, `media aritmetica simples` e `maior` `R$/unidade-base` calculados sobre cada ocorrencia de `invoice_item` comparavel no periodo filtrado
**And** deve ordenar a listagem por `display_name asc`
**And** deve retornar ate `50` grupos por resposta nesta story

### Cenario 3: detalhe de grupo comparavel
**Given** um grupo comparavel listado no historico
**When** o usuario abrir o detalhe desse grupo
**Then** a UI deve mostrar os SKUs membros do grupo
**And** deve mostrar os agregados do periodo consultado
**And** deve listar `recent_items[5]` com os `5` registros comparaveis mais recentes do periodo consultado, ordenados por `purchase_date desc`

### Cenario 4: itens fora da camada comparavel
**Given** produtos sem unidade base confiavel, sem vinculo comparavel valido ou sem ocorrencia comparavel valida no periodo
**When** o usuario consultar o modo `Comparaveis`
**Then** esses produtos nao devem aparecer nessa visao
**And** um grupo deve aparecer quando tiver ao menos uma ocorrencia valida no periodo filtrado

### Cenario 5: contrato minimo do modo comparavel
**Given** o frontend consultando o modo `Comparaveis`
**When** a API for chamada com `view=comparable&period_days=90`
**Then** a listagem deve retornar ao menos `id`, `display_name`, `base_unit`, `min_unit_price`, `avg_unit_price` e `max_unit_price`
**And** o detalhe do grupo deve retornar ao menos `id`, `display_name`, `base_unit`, `members[]`, `aggregates { min_unit_price, avg_unit_price, max_unit_price }` e `recent_items[5]`
**And** o detalhe deve usar `GET /api/product-groups/[id]/history?period_days=90`
**And** `period_days` deve aceitar apenas `30`, `90` ou `180`, retornando `400` para outros valores
**And** as rotas devem retornar `401` sem sessao e `404` para grupo inexistente ou de outro usuario
**And** o mesmo contrato de `period_days` deve valer para `GET /api/products` e `GET /api/products/[id]`

## Requisitos Nao Funcionais

1. A tela deve ser legivel e navegavel em mobile.
2. A agregacao deve considerar o periodo filtrado da tela.
3. O modo `Produtos` nao pode perder o comportamento atual.
4. A listagem comparavel deve usar apenas grupos com unidade base consistente.
5. Todas as consultas do modo comparavel devem respeitar isolamento estrito por `user_id` e RLS.
6. Esta story implementa o filtro de periodo compartilhado entre os modos `Produtos` e `Comparaveis`, com opcoes `30`, `90` e `180`, e padrao de `90` dias.
7. No modo `Comparaveis`, a busca textual deve usar `display_name` do grupo; `category` e `quickFilter` atuais continuam fora do escopo desse modo.

## Spec Tecnica Curta

1. O modo `Produtos` continua usando `GET /api/products?period_days=90` e `GET /api/products/[id]?period_days=90`.
2. No modo `Produtos`, `avg_price`, `purchase_count`, `last_purchase`, historico do detalhe e `price_variation_6m` devem respeitar `period_days`.
3. A listagem do modo comparavel usa `GET /api/product-groups?view=comparable&period_days=90`.
4. A listagem comparavel aceita `search` para filtrar por `display_name`; `category` e `quickFilter` enviados nesse modo devem ser ignorados.
5. O valor de `search` deve ser compartilhado entre os modos; `category` e `quickFilter` continuam exclusivos do modo `Produtos`.
6. Agregacao: `min`, `avg` e `max` sobre `comparable_unit_price` por ocorrencia de `invoice_item` com `comparable_unit_price` nao nulo e `comparable_base_unit` igual ao `base_unit` do grupo no periodo filtrado.
7. Sem tratamento especial de outlier nesta story; qualquer refinamento futuro deve virar nova story.
8. O detalhe deve retornar `members[]` com shape minimo `{ product_id, product_label, brand }`, ordenados por `product_label asc`.
9. O detalhe deve retornar `recent_items[]` com shape minimo `{ invoice_item_id, purchase_date, comparable_unit_price, product_id, product_label }`, ordenados por `purchase_date desc`.
10. Esta story implementa o filtro de periodo compartilhado entre os modos `Produtos` e `Comparaveis`, com opcoes `30`, `90` e `180`, e padrao de `90` dias.
11. A listagem comparavel retorna ate `50` grupos sem paginacao nesta entrega; resultados adicionais ficam fora do escopo.
12. O `id` da listagem comparavel deve ser o `product_group.id` canonico usado pela rota `GET /api/product-groups/[id]/history`.

## Definition of Done

1. A tela `Historico` alterna entre `Produtos` e `Comparaveis` sem erro.
2. O filtro de periodo existe e e compartilhado entre os dois modos.
3. A listagem comparavel retorna o contrato minimo definido na story.
4. O detalhe retorna `members[]`, `aggregates` e `recent_items[5]`.
5. Produtos sem unidade base confiavel ou sem ocorrencia comparavel valida no periodo nao aparecem no modo comparavel.
6. `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` passam.
7. PR aprovado e merged com evidencias da entrega.
8. Issue atualizada no Linear com evidencias e links relevantes.

## Dependencias

1. `CAT-03` - preco comparavel persistido.
2. `CAT-04` - dados editaveis de produto e grupo, se a UI expuser atalhos existentes.
3. `CAT-05` - opcional apenas para atalhos de revisao, nao para o core da story.

## Riscos e Rollback

1. Risco de UX confusa se a diferenca entre SKU e grupo nao ficar clara.
2. Risco de metricas agregadas inconsistentes com o filtro aplicado.
3. Rollback deve remover apenas o modo `Comparaveis`, preservando o historico atual por SKU.

## Estrategia de Validacao

1. Testes de integracao para query e agregacao por grupo comparavel.
2. Testes de UI para alternancia `Produtos` e `Comparaveis`.
3. Validacao de casos com grupos validos e produtos fora da camada comparavel.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test", "npm run build"]

## Tasks / Subtasks

- [ ] Implementar filtro de periodo compartilhado entre os modos.
- [ ] Ajustar listagem de produtos para aceitar `period_days` preservando o comportamento atual.
- [ ] Ajustar listagem comparavel para suportar `view=comparable&period_days=90`.
- [ ] Implementar modo comparavel na tela `Historico`.
- [ ] Implementar detalhe de grupo comparavel em `GET /api/product-groups/[id]/history`.
- [ ] Validar contrato de `period_days`, `401` e `404` nas rotas novas e ajustadas.
- [ ] Cobrir a alternancia de modo e os casos sem comparabilidade.

## Dev Notes

- A tela atual `app/historico/page.tsx` e centrada em SKU.
- O fluxo desejado precisa responder a pergunta de compra no corredor do mercado.
- Esta story fica focada em listagem e detalhe comparavel, sem assumir workflow completo de edicao ou revisao.
- Arquivos no escopo minimo desta entrega: `app/historico/page.tsx`, `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, `app/api/product-groups/route.ts` e `app/api/product-groups/[id]/history/route.ts`.
- A validacao de `period_days` deve ficar centralizada em schema/util compartilhavel para evitar divergencia entre `GET /api/products`, `GET /api/products/[id]`, `GET /api/product-groups` e `GET /api/product-groups/[id]/history`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.4 | Validacao PO reforcou cobertura de erros/contrato e ancorou caminhos de implementacao | OpenCode |
| 2026-04-16 | 2.3 | Ajuste final de contrato de period_days, campo temporal e quality gate | OpenCode |
| 2026-04-16 | 2.2 | Ajuste final de filtros legados, ordenacao e id canonico | OpenCode |
| 2026-04-16 | 2.1 | Ajuste final de rota, filtro de periodo e contrato do detalhe | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com escopo reduzido e metricas observaveis | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
