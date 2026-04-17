# Story CAT-05: Sugestoes Heuristicas de Agrupamento

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** receber sugestoes de agrupamento entre produtos parecidos,
**para** economizar tempo ao organizar meu catalogo comparavel.

## Cenarios (Gherkin)

### Cenario 1: gerar sugestao sem agrupar automaticamente
**Given** produtos do mesmo usuario com unidade base compativel
**When** o usuario chamar `GET /api/product-group-suggestions` e a heuristica identificar score `>= 0.75`
**Then** o sistema deve gerar uma sugestao de agrupamento
**And** nao deve aplicar o agrupamento automaticamente

### Cenario 2: contrato minimo da sugestao
**Given** uma sugestao gerada
**When** ela for retornada pela API
**Then** a resposta deve incluir `id`, `source_product_id`, `target_group_id`, `confidence`, `reasons[]` e `status`
**And** deve existir no maximo `1` sugestao pendente por `source_product_id`

### Cenario 3: aceitar sugestao
**Given** uma sugestao pendente pertencente ao usuario
**When** o usuario aceitar a sugestao
**Then** o sistema deve associar o produto de origem a um grupo comparavel existente informado na sugestao
**And** deve registrar a decisao de forma auditavel

### Cenario 4: contratos de decisao
**Given** uma sugestao pendente
**When** o usuario decidir sobre ela
**Then** `POST /api/product-group-suggestions/[id]/accept` deve aceitar a sugestao
**And** `POST /api/product-group-suggestions/[id]/reject` deve rejeitar a sugestao
**And** ambas as rotas devem retornar `404` para sugestao inexistente ou de outro usuario
**And** devem retornar `401` para usuario sem sessao
**And** nao devem exigir payload no body
**And** devem retornar `400` quando a sugestao estiver obsoleta ou invalidada no momento da decisao

### Cenario 5: rejeitar sugestao
**Given** uma sugestao pendente pertencente ao usuario
**When** o usuario rejeitar a sugestao
**Then** o sistema deve registrar a rejeicao
**And** a mesma sugestao para o par `source_product_id + target_group_id` nao deve reaparecer ate ocorrer pelo menos uma destas mudancas materiais: `normalized_name`, `category`, `comparable_base_unit` ou `target_group_id`
**And** ou ate o score recalculado para o mesmo `target_group_id` subir ao menos `0.15` acima do score rejeitado

### Cenario 6: isolamento por usuario
**Given** dados de multiplos usuarios
**When** sugestoes forem geradas, listadas ou decididas
**Then** nenhuma sugestao deve cruzar produtos de usuarios diferentes

### Cenario 7: efeito e disponibilidade das sugestoes
**Given** um usuario com catalogo comparavel existente
**When** ele chamar `GET /api/product-group-suggestions`
**Then** a API deve calcular ou atualizar as sugestoes nesse momento
**And** deve retornar apenas sugestoes pendentes e elegiveis para exibicao
**And** uma nova recomputacao deve substituir a sugestao pendente anterior do mesmo `source_product_id`, marcando a anterior como `superseded`

## Requisitos Nao Funcionais

1. A heuristica deve exigir unidade base compativel antes de sugerir agrupamento.
2. Marca pode influenciar `confidence`, mas nao pode bloquear sugestao por si so.
3. Toda decisao do usuario sobre sugestoes deve ser auditavel.
4. O sistema deve suportar listagem estavel das sugestoes pendentes do usuario.
5. A ordenacao padrao da listagem deve ser `confidence desc, created_at desc`.

## Spec Tecnica Curta

1. Gatilho de geracao: `GET /api/product-group-suggestions` calcula ou atualiza sugestoes on-demand.
2. Alvo da sugestao e sempre um `target_group_id` existente; esta story nao cria grupo novo automaticamente.
3. Rotas de decisao: `POST /api/product-group-suggestions/[id]/accept` e `POST /api/product-group-suggestions/[id]/reject`.
4. Rejeicao persiste `score` e sinais usados para que a regra de reexibicao seja verificavel.
5. Estrutura persistida minima: `id`, `user_id`, `source_product_id`, `target_group_id`, `confidence`, `reasons`, `status`, `signals_snapshot`, `decision_at`, `changed_by`, `change_origin`, `created_at`, `updated_at`.
6. Enum de `status`: `pending`, `accepted`, `rejected`, `superseded`.
7. Sugestao obsoleta e qualquer sugestao cujo `target_group_id`, `comparable_base_unit` ou estado atual de associacao do `source_product_id` tenha mudado antes da decisao.

## Definition of Done

1. `GET /api/product-group-suggestions` retorna sugestoes pendentes com contrato minimo da story.
2. Rotas de aceitar e rejeitar implementadas e testadas.
3. Aceite associa produto a grupo existente; rejeicao persiste score e sinais.
4. Regra de reexibicao apos rejeicao coberta por teste.
5. `npm run lint`, `npx tsc --noEmit` e `npm test` passam.

## Dependencias

1. `CAT-02.persistencia-grupos-comparaveis.md` - persistencia de grupos e vinculos.
2. `CAT-04.apis-edicao-produto-grupo.md` - APIs e semantica de associacao manual, se reutilizadas.

## Riscos e Rollback

1. Risco de heuristica gerar ruido demais e reduzir confianca do usuario.
2. Risco de rejeicoes nao serem persistidas e a UX entrar em loop.
3. Rollback deve permitir desligar geracao e exibicao de sugestoes sem afetar grupos ja confirmados.

## Estrategia de Validacao

1. Testes de heuristica cobrindo categoria, nucleo textual e unidade base.
2. Testes de API para listar, aceitar e rejeitar sugestoes.
3. Testes de reexibicao apos rejeicao com e sem mudanca material.

## Estimativa

`M`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Definir sinais da heuristica e limiar minimo de sugestao.
- [ ] Definir estrutura persistida para sugestoes e decisoes.
- [ ] Expor endpoint de listagem de sugestoes.
- [ ] Expor acoes de aceitar e rejeitar.
- [ ] Validar exemplos reais com tamanhos e marcas diferentes.

## Dev Notes

- A heuristica deve considerar categoria, nucleo textual e compatibilidade de unidade base.
- Marca nao impede sugestao, mas tambem nao deve forcar agrupamento.
- A decisao final e sempre do usuario.
- A regra de reexibicao apos rejeicao precisa usar uma mudanca material observavel.
- Novas rotas devem seguir o padrao de `app/api/.../route.ts`, criando o namespace `app/api/product-group-suggestions/` e suas acoes por `id`.
- Autenticacao de rota deve reaproveitar `getSessionUserId()` de `lib/auth-session.ts`.
- Mutacoes e recomputacoes que escrevem no banco devem aplicar isolamento com `setAppUserId(...)` de `lib/session-sql.ts`.
- Schemas de request/response devem ficar em `lib/validations.ts` ou modulo adjacente coerente com o padrao atual do projeto.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.2 | Validacao PO concluida com GO e dev notes ancoradas no source tree | OpenCode |
| 2026-04-16 | 2.1 | Ajuste final de IDs, stale suggestion e auditoria | OpenCode |
| 2026-04-16 | 2.0 | Reescrita para formato Ready com contrato de sugestao e regra de rejeicao | OpenCode |
| 2026-04-16 | 1.0 | Criacao inicial da story | River (SM) |
