# Story CAT-03: Importacao com Preco Comparavel

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** que a importacao da nota ja salve preco comparavel por `kg` ou `L`,
**para** consultar referencias uteis no historico sem recalculo pesado posterior.

## Cenarios (Gherkin)

### Cenario 1: item embalado com medida confiavel
**Given** um item importado com massa ou volume confiavel em unidade base `kg` ou `L`
**When** a nota fiscal for persistida
**Then** o sistema deve calcular e salvar `comparable_base_unit`, `comparable_quantity_base` e `comparable_unit_price`
**And** deve registrar `measurement_source` e `measurement_confidence`

### Cenario 2: item vendido por peso
**Given** um item extraido como vendido por peso e com `unit_price` ja em `R$/kg`
**When** a importacao finalizar
**Then** o sistema deve reutilizar `unit_price` como referencia comparavel
**And** deve persistir `measurement_source = scale_item`
**And** deve persistir `comparable_base_unit = kg` e `comparable_quantity_base = 1`

### Cenario 3: item embalado com calculo derivado da embalagem
**Given** um item como `creme de leite 200g` ou `leite 1L`
**When** a importacao processar o registro
**Then** o sistema deve calcular `R$/kg` ou `R$/L` a partir de `total_price / (comparable_quantity_base * quantity)` apenas quando `quantity > 1` representar multiplas embalagens identicas na linha
**And** deve usar `total_price / comparable_quantity_base` quando `quantity = 1`
**And** essa formula so se aplica a item embalado com `measurement_source != scale_item`
**And** `comparable_quantity_base` ja deve chegar com o multipack interno da descricao embutido, como `2x90g -> 0.18`

### Cenario 4: item sem medida confiavel
**Given** um item sem massa ou volume confiavel
**When** a nota fiscal for salva
**Then** o item deve continuar sendo persistido normalmente
**And** `comparable_base_unit`, `comparable_quantity_base` e `comparable_unit_price` devem permanecer nulos
**And** `measurement_source` e `measurement_confidence` devem continuar persistidos para auditoria

### Cenario 5: exemplos reais do dominio
**Given** itens como `tomate 0,680kg`, `creme de leite 200g` e `suco 1L`
**When** a importacao for executada
**Then** `tomate 0,680kg` com `measurement_source = scale_item` deve persistir `comparable_unit_price = unit_price`
**And** `creme de leite 200g` deve persistir `comparable_unit_price = total_price / 0.2`
**And** `suco 1L` deve persistir `comparable_unit_price = total_price / 1`

## Requisitos Nao Funcionais

1. A importacao nao pode quebrar itens que hoje ja entram corretamente no historico bruto.
2. O calculo comparavel deve ser deterministico para a mesma combinacao de item, unidade e preco.
3. O fluxo deve tolerar itens sem comparabilidade sem falhar a importacao completa.
4. `comparable_unit_price` deve ser persistido com precisao minima de 4 casas decimais; arredondamento de exibicao fica para a UI.
5. Apenas itens com `measurement_confidence >= 0.8` entram no calculo comparavel automatico.

## Spec Tecnica Curta

1. Entradas usadas no calculo: `quantity`, `unit_price`, `total_price`, `comparable_quantity_base`, `measurement_source`, `measurement_confidence`.
2. Campos persistidos: `comparable_base_unit`, `comparable_quantity_base`, `comparable_unit_price`, `measurement_source`, `measurement_confidence`.
3. `comparable_quantity_base` ja inclui o multipack descrito no proprio produto, como `2x90g -> 0.18kg`.
4. Evidencia de multipla embalagem na linha vem do campo `quantity` da importacao quando `quantity` for inteiro maior que `1` para item embalado; multipack do nome do produto deve ter sido resolvido antes em `comparable_quantity_base` por `CAT-01`.
5. Itens por peso com `measurement_source = scale_item` reutilizam `unit_price` como `comparable_unit_price`; este e o valor canonico para `scale_item`.
6. Em item nao comparavel, `comparable_base_unit`, `comparable_quantity_base` e `comparable_unit_price` ficam nulos, mas `measurement_source` e `measurement_confidence` permanecem persistidos para auditoria.

## Dependencias

1. `CAT-01` - parser e metadados de unidade.
2. `CAT-02` - campos persistidos de comparacao.

## Riscos e Rollback

1. Risco de calcular preco comparavel com base errada em descricoes ambiguas.
2. Risco de persistir metadados inconsistentes se parser e schema divergirem.
3. Rollback deve permitir interromper a escrita dos campos comparaveis sem afetar a importacao bruta.

## Estrategia de Validacao

1. Testes de integracao no fluxo de importacao para itens embalados e itens por peso.
2. Testes cobrindo campos nulos para itens sem medida confiavel.
3. Validacao com exemplos reais de mercado citados na story.

## Definition of Done

1. Campos comparaveis persistidos conforme contrato de `CAT-02`.
2. `scale_item` reutiliza `unit_price` como valor canonico.
3. Multipack de linha e item nao comparavel cobertos por testes.
4. Importacao continua funcionando para itens sem comparabilidade.
5. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Integrar parser e tipos comparaveis ao fluxo de importacao.
- [ ] Calcular `comparable_base_unit`, `comparable_quantity_base` e `comparable_unit_price` por item.
- [ ] Persistir `measurement_source` e `measurement_confidence`.
- [ ] Cobrir exemplos reais como creme de leite, tomate e bebidas.
- [ ] Adicionar testes do fluxo de importacao.

## Dev Notes

- O fluxo atual de importacao esta em `app/api/invoices/route.ts`.
- A extracao ja instrui o modelo a tratar itens por peso como `R$/kg` em `app/api/extract-pdf/route.ts`.
- O calculo para itens embalados deve ser derivado da embalagem extraida ou corrigida pelo parser.
- Os nomes exatos dos campos persistidos devem seguir o schema definido em `CAT-02`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.1 | Ajuste final do contrato de persistencia e multipack | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com contratos observaveis e dependencias explicitas | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
