# Story CAT-01: Infra de Unidade Comparavel e Parsing de Embalagem

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** que o sistema entenda peso e volume das embalagens,
**para** converter precos para `R$/kg` e `R$/L` com confianca.

## Cenarios (Gherkin)

### Cenario 1: extrair medida simples da descricao
**Given** um item com descricao contendo `200g`, `1kg`, `500ml` ou `1L`
**When** o parser de embalagem processar a descricao
**Then** a infra deve retornar `original_quantity`, `original_unit`, `comparable_base_unit` e `comparable_quantity_base`
**And** `comparable_base_unit` deve ser normalizada para `kg` ou `L`

### Cenario 2: item vendido por peso na nota
**Given** um item extraido como vendido por peso e com `unit_price` ja em `R$/kg`
**When** a normalizacao de backend calcular o payload comparavel
**Then** deve expor `is_scale_item: boolean`
**And** o parser deve marcar `measurement_source = scale_item`
**And** `scale_item` deve ter precedencia sobre `description`
**And** o contrato deve retornar `comparable_base_unit = kg` e `comparable_quantity_base = 1`
**And** o parser nao deve inventar embalagem inexistente para esse item

### Cenario 3: item sem medida confiavel
**Given** um item cuja descricao nao permita inferir massa ou volume com confianca suficiente
**When** o parser processar a descricao
**Then** o sistema deve marcar `is_comparable = false`
**And** deve registrar `measurement_confidence < 0.8`

### Cenario 4: descricoes ambiguas ou compostas
**Given** um item com descricao como `2x90g`, `500ml + 100ml`, `cx 12 un` ou `pct 5 un`
**When** o parser processar a descricao
**Then** `2x90g` deve resultar em `original_quantity = 180`, `original_unit = g`, `comparable_base_unit = kg` e `comparable_quantity_base = 0.18`
**And** `500ml + 100ml` deve resultar em `original_quantity = 600`, `original_unit = ml`, `comparable_base_unit = L` e `comparable_quantity_base = 0.6`
**And** `cx 12 un` e `pct 5 un` devem resultar em `is_comparable = false`

### Cenario 5: origem e confianca da medicao
**Given** um item com medida encontrada na descricao ou com valor reservado para inferencia futura
**When** os metadados comparaveis forem montados
**Then** o sistema deve registrar `measurement_source`
**And** deve registrar `measurement_confidence` como numero decimal entre `0` e `1`
**And** `scale_item` deve usar `measurement_confidence = 1`
**And** parse direto de descricao simples como `200g`, `1L` e `680g` deve usar `measurement_confidence >= 0.9`
**And** parse composto como `2x90g` e `500ml + 100ml` deve usar `measurement_confidence >= 0.8`

### Cenario 6: contrato minimo de saida da infra
**Given** uma descricao processada pelo parser
**When** o resultado for entregue ao restante do sistema
**Then** a infra deve devolver `original_quantity`, `original_unit`, `comparable_base_unit`, `comparable_quantity_base`, `measurement_source`, `measurement_confidence`, `is_comparable` e `is_scale_item`
**And** quando `is_comparable = false`, `comparable_base_unit` e `comparable_quantity_base` devem ser nulos
**And** `original_quantity` e `original_unit` podem ser nulos quando nao houver parse confiavel
**And** em `scale_item`, `original_quantity` e `original_unit` devem refletir a evidencia bruta extraida quando disponivel

## Requisitos Nao Funcionais

1. O parser deve produzir o mesmo resultado para a mesma descricao.
2. O parser nao pode regredir o tratamento atual de itens vendidos por peso.
3. Casos reais de OCR ruidoso devem ser cobertos por testes unitarios.
4. Todas as strings e exibicoes derivadas devem continuar em pt-BR quando chegarem a UI.

## Dependencias

1. Nenhuma story anterior do epic.
2. Base para `CAT-02` e `CAT-03`.

## Riscos e Rollback

1. Risco de inferir medida errada em descricoes ambiguas.
2. Risco de marcar item comparavel como nao comparavel por limiar muito agressivo.
3. Rollback deve permitir voltar ao comportamento legado por reversao de codigo sem exigir feature flag nova.

## Estrategia de Validacao

1. Testes unitarios para `g`, `kg`, `ml`, `L`, multipack e casos ambiguos.
2. Testes unitarios especificos para itens por peso ja extraidos como `R$/kg`.
3. Verificacao de contratos dos novos tipos e enums usados na importacao.

## Spec Tecnica Curta

1. Contrato minimo de saida: `original_quantity`, `original_unit`, `comparable_base_unit`, `comparable_quantity_base`, `measurement_source`, `measurement_confidence`, `is_comparable`, `is_scale_item`.
2. Precedencia de fonte implementada nesta story: `scale_item` > `description`.
3. `measurement_source` deve usar dominio fechado: `description`, `scale_item`, `rule_inference`.
4. `is_comparable = true` apenas quando `measurement_confidence >= 0.8` e houver `comparable_base_unit` em `kg | L`.
5. Convencao para `scale_item`: `comparable_base_unit = kg`, `comparable_quantity_base = 1` e `is_scale_item = true`.
6. `comparable_base_unit` guarda apenas `kg | L`; `comparable_quantity_base` guarda apenas a quantidade normalizada numerica.
7. Exemplos fora do escopo desta story devem retornar `is_comparable = false`, nunca heuristica silenciosa.
8. Nesta story, `rule_inference` existe apenas como valor reservado do contrato; nenhuma regra nova alem de `description` e `scale_item` e obrigatoria.
9. `is_scale_item` e calculado na normalizacao de backend apos a extracao estruturada, nao diretamente no schema de IA.

## Definition of Done

1. Contrato minimo de saida definido e coberto por testes.
2. Precedencia entre `scale_item` e `description` coberta por testes.
3. Casos simples, compostos e ruidosos definidos na story cobertos por testes.
4. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Definir enums e tipos de unidade base comparavel.
- [ ] Estender o payload normalizado com `is_scale_item`.
- [ ] Criar parser estruturado para `g`, `kg`, `ml` e `L`.
- [ ] Implementar normalizacao para `kg` e `L`.
- [ ] Definir `measurement_confidence` e `measurement_source`.
- [ ] Cobrir casos reais e bordas com testes unitarios.

## Dev Notes

- `lib/invoice-utils.ts` hoje so extrai unidade de forma textual simples em `extractUnit()`.
- O parser novo deve servir tanto para importacao quanto para consultas futuras.
- O prompt atual de extracao em `app/api/extract-pdf/route.ts` ja define que itens por peso usam `unit_price` como preco por kg.
- Itens como `un`, `cx`, `pct` e outras unidades de contagem nao entram automaticamente na camada comparavel.
- `measurement_source` deve usar um dominio fechado, ao menos: `description`, `scale_item`, `rule_inference`.
- Cobrir explicitamente entradas como `3x200ml`, `2 un 90g`, `1,5L`, `680g`, `0,680kg` e OCR com pontuacao variavel nos testes da story.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.2 | Ajuste final de escopo de rule_inference e origem de is_scale_item | OpenCode |
| 2026-04-16 | 2.1 | Ajuste final do contrato de scale_item e confianca deterministica | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com Gherkin, bordas e validacao | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
