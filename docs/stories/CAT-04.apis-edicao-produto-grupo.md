# Story CAT-04: APIs de Edicao de Produto e Grupo Comparavel

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** editar o produto individual e o grupo comparavel,
**para** ajustar como o sistema organiza e compara meus produtos.

## Cenarios (Gherkin)

### Cenario 1: criar grupo comparavel
**Given** um usuario autenticado
**When** ele enviar um payload valido para criar um grupo comparavel
**Then** `POST /api/product-groups` deve criar o grupo para o `user_id` ativo
**And** deve retornar `201` com `id`, `display_name` e `base_unit`
**And** o request deve exigir `display_name` e `base_unit`, com `base_unit` restrito a `kg | L`

### Cenario 2: editar grupo comparavel
**Given** um grupo comparavel pertencente ao usuario
**When** ele enviar um payload valido para atualizar o grupo
**Then** `PATCH /api/product-groups/[id]` deve permitir editar apenas `display_name`
**And** deve retornar ao menos `id`, `display_name` e `base_unit`
**And** deve retornar `404` para grupos inexistentes ou de outro usuario

### Cenario 3: editar produto individual
**Given** um `product` pertencente ao usuario
**When** ele atualizar os campos permitidos do produto
**Then** `PATCH /api/products/[id]` deve permitir editar apenas `brand`
**And** deve retornar ao menos `id` e `brand`
**And** a API deve salvar a alteracao sem destruir o historico bruto do SKU

### Cenario 4: associar produto a grupo comparavel
**Given** um `product` e um grupo comparavel do mesmo usuario
**When** o usuario solicitar a associacao
**Then** `POST /api/products/[id]/group-assignment` deve vincular o produto ao grupo informado
**And** deve preservar `product_id` e historico anterior do SKU
**And** deve registrar evento auditavel de `associate` na trilha de membership
**And** a API deve rejeitar com `400` associacao para grupo com `base_unit` incompativel com a ultima evidencia comparavel valida do produto
**And** se o produto ja estiver associado a outro grupo, a API deve retornar `409` e exigir `DELETE` antes de nova associacao
**And** se o produto ja estiver associado ao mesmo grupo, a API deve responder `200` com o vinculo atual e sem registrar novo evento de auditoria
**And** quando nao houver evidencia comparavel valida, a associacao so pode prosseguir se o request enviar `allow_missing_comparable_evidence = true`

### Cenario 5: remover produto da comparacao
**Given** um `product` associado a um grupo comparavel
**When** o usuario solicitar remover esse produto da comparacao
**Then** `DELETE /api/products/[id]/group-assignment` deve responder `204` e limpar `comparable_group_id`
**And** nao deve apagar `invoice_items` historicos
**And** nao deve marcar qualquer outro campo de exclusao implicitamente
**And** deve registrar evento auditavel de `disassociate` na trilha de membership
**And** se o produto ja estiver sem grupo, a rota deve continuar idempotente e responder `204`, sem registrar novo evento de auditoria

### Cenario 6: autorizacao e validacao
**Given** uma requisicao sem sessao, com payload invalido ou com recurso de outro usuario
**When** a API for chamada
**Then** ela deve retornar o status HTTP adequado
**And** deve usar `401` para requisicao sem sessao
**And** deve usar `400` para payload invalido ou incompatibilidade de unidade
**And** deve usar `404` para recursos inexistentes ou de outro usuario
**And** deve usar `409` para conflito de unicidade de grupo ou tentativa de reassociacao sem `DELETE` previo

## Requisitos Nao Funcionais

1. Rotas mutaveis devem seguir o padrao de autenticacao do projeto.
2. Toda mutacao deve aplicar RLS com `setAppUserId(...)` no client usado pela operacao.
3. Contratos de request e response devem ser validados por schema.
4. A API deve retornar erros previsiveis para `401`, `400`, `404` e `409`.

## Spec Tecnica Curta

1. Rotas no escopo:
   - `POST /api/product-groups`
   - `PATCH /api/product-groups/[id]`
   - `PATCH /api/products/[id]`
   - `POST /api/products/[id]/group-assignment`
   - `DELETE /api/products/[id]/group-assignment`
2. Contrato de criacao de grupo: `{ display_name, base_unit }` com `base_unit` em `kg | L`.
3. Contrato de edicao de grupo: `{ display_name }`.
4. Contrato de edicao de produto: `{ brand? }`.
5. Contrato de associacao: `{ group_id, allow_missing_comparable_evidence?: boolean }`.
6. Compatibilidade de unidade deve usar a ultima evidencia valida em `invoice_items` com `comparable_base_unit` nao nulo para aquele produto, ordenada por `invoices.purchase_date desc`.
7. Quando nao houver evidencia comparavel valida do produto, a associacao so pode prosseguir com `allow_missing_comparable_evidence = true`.
8. Remover da comparacao significa limpar `products.comparable_group_id`; nao significa apagar historico nem marcar exclusao automaticamente.
9. Recursos de outro usuario devem responder `404` para evitar enumeracao.
10. Associacao e desassociacao devem registrar evento auditavel na estrutura definida em `CAT-02`.
11. Criacao ou edicao de grupo com conflito de unicidade deve retornar `409`.

## Dependencias

1. `CAT-02` - schema persistido de grupos e vinculos.
2. `CAT-03` - evidencia comparavel usada na validacao de compatibilidade quando disponivel.

## Riscos e Rollback

1. Risco de mutacao afetar produtos de outro usuario se ownership nao for checado corretamente.
2. Risco de semantica ambigua para remocao ou reassociacao causar implementacoes divergentes.
3. Rollback deve desativar apenas as rotas novas sem afetar rotas de leitura existentes.

## Estrategia de Validacao

1. Testes de integracao para criar grupo, editar grupo, editar produto, associar e desassociar.
2. Testes negativos para `401`, `404`, `400` e `409`.
3. Validacao de response e payloads com schemas do projeto.

## Definition of Done

1. Todas as rotas acima implementadas com schema de request e response.
2. `401`, `404`, `400` e `409` cobertos por testes.
3. Mutacoes respeitam RLS e ownership.
4. Associacao e desassociacao preservam historico bruto.
5. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Definir contratos de request e response para produto e grupo comparavel.
- [ ] Criar rotas de criacao e edicao de grupos.
- [ ] Criar rota de edicao de produto individual.
- [ ] Implementar associacao e remocao da comparacao.
- [ ] Cobrir autorizacao, ownership, conflito e payload invalido com testes.

## Dev Notes

- O repositorio ja possui rotas de leitura em `app/api/products/route.ts` e `app/api/products/[id]/route.ts`; esta story adiciona metodos mutaveis sem quebrar os `GET` existentes.
- Seguir o padrao de autenticacao e isolamento ja usado nas outras APIs com `getSessionUserId()`.
- Aplicar `setAppUserId(...)` nas mutacoes para manter RLS estrito.
- Os campos editaveis devem ser explicitamente limitados pelo contrato das rotas.
- As novas rotas devem seguir o padrao `app/api/.../route.ts`, criando `app/api/product-groups/route.ts`, `app/api/product-groups/[id]/route.ts` e `app/api/products/[id]/group-assignment/route.ts`.
- Os schemas de request/response devem ficar em `lib/validations.ts` ou em modulo adjacente coerente com o padrao atual do projeto.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.3 | Validacao PO concluida com GO, eliminando ambiguidade de auditoria e ancorando dev notes no source tree | OpenCode |
| 2026-04-16 | 2.2 | Ajuste final de timestamps, campos editaveis e semantica idempotente | OpenCode |
| 2026-04-16 | 2.1 | Ajuste final de contratos, conflitos e compatibilidade de unidade | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com contrato de API, erros e ownership | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
