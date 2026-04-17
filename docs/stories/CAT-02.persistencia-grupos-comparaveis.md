# Story CAT-02: Persistencia de Grupos Comparaveis

**Status**: Ready

## Story

**Como** responsavel pela evolucao do catalogo do usuario,
**eu quero** persistir grupos comparaveis e campos derivados de comparacao,
**para** permitir consultas estaveis, auditaveis e isoladas por usuario.

## Cenarios (Gherkin)

### Cenario 1: estrutura persistida de grupos comparaveis
**Given** um usuario autenticado
**When** a migracao da feature for aplicada
**Then** deve existir uma estrutura persistida para grupos comparaveis isolada por `user_id`
**And** essa estrutura deve permitir `display_name` e `base_unit`
**And** `base_unit` deve aceitar apenas `kg` ou `L`

### Cenario 2: vinculo opcional do produto com grupo
**Given** um `product` existente do usuario
**When** ele for associado a um grupo comparavel
**Then** o vinculo com o grupo deve ser opcional
**And** o `product` deve continuar existindo como SKU independente

### Cenario 3: exclusao da comparacao sem apagar historico
**Given** um `product` vinculado a um grupo comparavel
**When** o usuario remover esse produto da comparacao
**Then** o vinculo atual em `products.comparable_group_id` deve ser limpo sem apagar o `product`
**And** nenhum registro historico de `invoice_items` deve ser deletado
**And** a alteracao deve ser registrada em uma trilha de auditoria de membership

### Cenario 4: campos derivados em `invoice_items`
**Given** o schema de `invoice_items` preparado para comparacao
**When** a migracao desta story for aplicada
**Then** `invoice_items` deve suportar os campos `comparable_base_unit`, `comparable_quantity_base`, `comparable_unit_price`, `measurement_source` e `measurement_confidence`
**And** esses campos nao devem substituir `product_id` nem `raw_description`

### Cenario 5: preservacao do catalogo bruto
**Given** produtos de marcas ou embalagens diferentes agrupados na camada comparavel
**When** o historico bruto for consultado
**Then** cada SKU deve continuar rastreavel individualmente
**And** o agrupamento nao deve mesclar produtos automaticamente em um unico `product_id`

## Requisitos Nao Funcionais

1. Todas as novas tabelas, campos e indices devem respeitar isolamento por `user_id`.
2. A modelagem deve permitir auditoria do vinculo entre SKU e grupo comparavel.
3. A persistencia nao pode quebrar consultas atuais do historico bruto.
4. Constraints e indices devem priorizar integridade antes de conveniencia de escrita.
5. O estado atual do vinculo pode viver em `products.comparable_group_id`, mas a auditoria deve viver em estrutura separada de historico.
6. `product_groups` deve ter nome de dominio fixo no schema e garantir unicidade de `display_name + base_unit + user_id`.

## Dependencias

1. `CAT-01` - usa a definicao de unidade base comparavel, `measurement_source` e `measurement_confidence`.
2. Base para `CAT-03` e `CAT-04`.

## Riscos e Rollback

1. Risco de schema insuficiente para suportar sugestoes e consultas futuras.
2. Risco de vazamento entre usuarios se `user_id` nao estiver presente em toda a cadeia.
3. Rollback deve remover apenas a camada comparavel, preservando `products` e `invoice_items` existentes.

## Estrategia de Validacao

1. Testes de migracao ou validacao de schema para novas estruturas.
2. Testes de integracao cobrindo criacao de grupo, associacao opcional e desassociacao.
3. Testes de isolamento por `user_id` em consultas e mutacoes relacionadas.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Definir schema para `product_groups`.
- [ ] Adicionar `products.comparable_group_id` como vinculo opcional de estado atual.
- [ ] Criar estrutura de auditoria para associacao e desassociacao de membership.
- [ ] Adicionar campos derivados de comparacao em `invoice_items`.
- [ ] Definir indices, constraints e politica de desassociacao.
- [ ] Garantir compatibilidade com isolamento por `user_id`.

## Spec Tecnica Curta

1. Entidades novas: `product_groups` e tabela de auditoria de membership do produto no grupo.
2. Campos novos em `products`: `comparable_group_id` nullable.
3. Campos novos em `invoice_items`: `comparable_base_unit`, `comparable_quantity_base`, `comparable_unit_price`, `measurement_source`, `measurement_confidence`.
4. Dominio de `comparable_base_unit` e `product_groups.base_unit`: apenas `kg | L`.
5. A remocao da comparacao limpa o vinculo atual, mas preserva historico bruto e trilha de auditoria.
6. Escopo tecnico minimo: migracao/schema e compatibilidade com `app/api/invoices/route.ts`; esta story nao implementa calculo nem escrita de importacao.
7. Contrato minimo da auditoria de membership: `event_type` (`associate` ou `disassociate`), `product_id`, `group_id`, `user_id`, `changed_by`, `created_at`.
8. `changed_by` deve receber o `user_id` da sessao quando a mudanca for manual e o literal `system` quando a mudanca vier de fluxo automatico controlado pelo backend.

## Definition of Done

1. Migracao criada e aplicavel para estruturas novas.
2. `products.comparable_group_id` e campos novos de `invoice_items` definidos.
3. Auditoria de membership registra associacao e desassociacao com o contrato minimo da story.
4. Fluxo de importacao e consultas principais continuam funcionais com os novos campos.
5. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Dev Notes

- O catalogo bruto atual e baseado em `normalized_name` criado no fluxo de `app/api/invoices/route.ts`.
- `products` e `invoice_items` hoje nao possuem camada de agrupamento comparavel.
- A relacao entre SKU e grupo deve ser logica, nao destrutiva.
- A modelagem desta story deve sustentar importacao, edicao manual e sugestoes heuristicas.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.0 | Reescrita para formato Ready com schema observavel e isolamento explicito | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
