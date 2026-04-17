# Story CAT-07: Lista de Compras com Referencia Comparavel

**Status**: Ready

## Story

**Como** usuario fazendo compras,
**eu quero** ver referencia comparavel na minha lista,
**para** decidir o que comprar sem calcular manualmente no corredor.

## Cenarios (Gherkin)

### Cenario 1: item com grupo comparavel
**Given** uma lista com item ligado a um grupo comparavel com unidade base confiavel
**When** o usuario abrir a tela `Lista`
**Then** o item deve exibir uma referencia comparavel em `R$/kg` ou `R$/L`
**And** essa referencia deve aparecer como informacao secundaria sem substituir o preco principal do item
**And** `comparable_unit_price` deve representar `avg_unit_price` do grupo no periodo padrao dos ultimos `90` dias

### Cenario 2: item sem comparacao disponivel
**Given** uma lista com item sem grupo comparavel ou sem historico comparavel no periodo de `90` dias
**When** o usuario abrir a tela `Lista`
**Then** o item deve continuar exibindo `last_price`
**And** na falta de `last_price`, deve exibir `estimated_price`
**And** na falta de ambos, deve exibir `Sem preco` na linha de preco unitario
**And** o total do item deve seguir o fallback `last_price`, senao `estimated_price`, senao `0`

### Cenario 3: contexto secundario util ao usuario
**Given** um item com referencia comparavel derivada de um grupo
**When** `comparable_group_name` existir e for diferente do nome principal do item
**Then** a UI deve exibir `comparable_group_name` como contexto secundario
**And** se `comparable_group_name` estiver ausente, a UI deve exibir `comparable_reference_label` como fallback de contexto secundario

### Cenario 4: contrato da API da lista
**Given** um item da lista com metadados comparaveis disponiveis
**When** a API da lista retornar os dados do item
**Then** a resposta deve incluir `comparable_unit_price`, `comparable_base_unit`, `comparable_reference_label` e `comparable_group_name` quando disponiveis
**And** esses campos podem ser nulos sem quebrar o item da lista
**And** `last_price` e `estimated_price` devem permanecer `null` no response quando ausentes, sem normalizacao para `0`

### Cenario 5: item avulso
**Given** um item avulso local sem historico nem produto vinculado
**When** o usuario o visualizar na sessao atual da tela `Lista`
**Then** o item deve continuar funcionando sem tentar resolver metadados comparaveis

## Requisitos Nao Funcionais

1. A referencia comparavel deve ser legivel em mobile e ocupar no maximo uma linha secundaria adicional.
2. Checkbox e controles de quantidade devem permanecer visiveis e acionaveis sem expandir o card em mobile.
3. Itens avulsos e sem historico devem continuar funcionando normalmente.
4. As referencias exibidas devem permanecer em BRL e pt-BR.
5. As consultas de metadados comparaveis devem respeitar isolamento estrito por `user_id` e RLS.

## Dependencias

1. `CAT-02` - vinculo do produto com grupo comparavel.
2. `CAT-03` - preco comparavel persistido.
3. `CAT-06` - definicao de referencia comparavel a ser mostrada ao usuario.

## Spec Tecnica Curta

1. A API da lista deve expor `comparable_unit_price`, `comparable_base_unit`, `comparable_reference_label` e `comparable_group_name` por item quando disponiveis.
2. Regra de fallback de preco e total: `last_price`, senao `estimated_price`, senao `0`; a linha de preco unitario usa `Sem preco` quando ambos forem nulos.
3. Regra de contexto secundario: `comparable_group_name`, senao `comparable_reference_label`, senao nada.
4. Escopo tecnico minimo: ajuste do response shape da rota `app/api/shopping-lists/[id]/route.ts`, mapper dos itens da lista e renderizacao em `app/lista/page.tsx`; a tela-resumo e `app/api/shopping-lists/route.ts` ficam explicitamente fora do escopo desta story.
5. Fonte de `comparable_unit_price`: `avg_unit_price` do grupo no periodo padrao dos ultimos `90` dias, usando o mesmo criterio de elegibilidade definido em `CAT-06`.
6. Item avulso permanece local ao cliente nesta story; nao entra no contrato persistido da API.
7. Quando nao houver historico comparavel no periodo de `90` dias, os campos comparaveis devem vir nulos e o item entra no fallback padrao.

## Definition of Done

1. API da lista retorna campos comparaveis opcionais no contrato definido.
2. UI renderiza referencia comparavel como informacao secundaria em no maximo uma linha adicional.
3. Fallback de preco e total continua usando `last_price`, senao `estimated_price`, senao `0`.
4. Item avulso continua funcional sem resolver metadados comparaveis.
5. Consultas respeitam `user_id` e RLS.
6. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Riscos e Rollback

1. Risco de poluir a UI da lista com informacao excessiva.
2. Risco de fallback quebrado em itens sem comparacao.
3. Rollback deve remover apenas os metadados comparaveis da lista, preservando o fluxo atual por SKU.

## Estrategia de Validacao

1. Testes de API para retorno dos metadados comparaveis.
2. Testes de UI para item com comparacao e item sem comparacao.
3. Validacao de UX mobile no fluxo de compra.

## Estimativa

`S`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Ajustar API da lista para retornar metadados comparaveis.
- [ ] Exibir referencia comparavel no item da lista.
- [ ] Definir fallback para itens sem comparacao.
- [ ] Validar UX mobile no fluxo de compra.
- [ ] Cobrir cenarios com e sem historico comparavel.

## Dev Notes

- Essa story fecha o loop de valor para o usuario.
- A tela `app/lista/page.tsx` hoje usa preco por SKU para estimativa.
- A referencia comparavel precisa ser legivel e rapida de interpretar no celular.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.2 | Ajuste final de nulabilidade de preco e escopo da tela-resumo | OpenCode |
| 2026-04-16 | 2.1 | Ajuste final de naming, fallback e escopo tecnico | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com contrato minimo de API e UX mobile | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
