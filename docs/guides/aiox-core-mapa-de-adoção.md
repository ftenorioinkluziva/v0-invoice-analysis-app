# Mapa de Adoção da `.aiox-core` — Onde o Framework ajuda no fluxo IA-Ágil

## Contexto
Este documento mapeia as capacidades da `.aiox-core` para as etapas do workflow de produto/engenharia (Triage → Spec → Implementação → QA → PR/Merge → Operação contínua).

---

## 1) Evidências encontradas na estrutura

- Núcleo de execução e orquestração: `.aiox-core/core/`
- Catálogo de agentes, tasks e workflows: `.aiox-core/development/`
- Workflows prontos: story cycle, spec pipeline, QA loop, epic orchestration
- Regras e quality gates: constitution + quality-gates + validações
- Gestão de contexto/sessão/elicitação: core/session + core/elicitation

Arquivos-chave:
- `.aiox-core/development/workflows/story-development-cycle.yaml`
- `.aiox-core/development/workflows/spec-pipeline.yaml`
- `.aiox-core/development/workflows/qa-loop.yaml`
- `.aiox-core/development/workflows/development-cycle.yaml`
- `.aiox-core/development/workflows/epic-orchestration.yaml`
- `.aiox-core/core/README.md`
- `.aiox-core/development/README.md`

---

## 2) Mapeamento por etapa do seu workflow

## Etapa A — Triage
Como ajuda:
- Padroniza triagem com tasks operacionais (ex.: issue triage, backlog management).
- Força consistência de classificação e encaminhamento.

Benefício prático:
- Menos issue vaga entrando em execução.
- Backlog mais limpo e previsível.

## Etapa B — Especificação (Spec-First)
Como ajuda:
- `spec-pipeline.yaml` organiza Gather → Assess → Research → Spec → Critique.
- Adapta fases por complexidade (SIMPLE/STANDARD/COMPLEX).
- Possui pre-flight checks e gates de bloqueio.

Benefício prático:
- Menos alucinação por falta de contexto.
- Menos retrabalho por requisitos incompletos.

## Etapa C — Desenvolvimento por story
Como ajuda:
- `story-development-cycle.yaml` define create → validate → implement → QA.
- `development-cycle.yaml` aplica executor dinâmico + quality gate + push/PR.

Benefício prático:
- Fluxo previsível por story.
- Separação clara de responsabilidade entre agentes.

## Etapa D — Correção iterativa de qualidade
Como ajuda:
- `qa-loop.yaml` automatiza review → fix → re-review com limite de iterações.
- Escala para intervenção humana quando necessário.

Benefício prático:
- Reduz regressão e “vai e volta” manual.
- Mantém ritmo mesmo com falhas intermediárias.

## Etapa E — Épicos e paralelismo controlado
Como ajuda:
- `epic-orchestration.yaml` organiza waves paralelas com gates de integração.
- Suporta isolamento por worktree e checkpoint entre waves.

Benefício prático:
- Escala execução sem perder controle de integração.
- Melhor para iniciativas grandes com várias histórias.

## Etapa F — Governança e determinismo
Como ajuda:
- Constitution + quality-gates + validações YAML/sessão/execução.
- Reforça critérios de prontidão e de conclusão.

Benefício prático:
- Menos variação de qualidade entre entregas.
- Processo auditável e repetível.

---

## 3) Onde usar em cada maturidade

## Nível 1 (adoção rápida)
- Usar apenas:
  - `story-development-cycle.yaml`
  - `qa-loop.yaml`
- Objetivo: padronizar execução e review imediatamente.

## Nível 2 (spec-first real)
- Adicionar:
  - `spec-pipeline.yaml`
- Objetivo: melhorar qualidade da entrada (Ready de verdade).

## Nível 3 (escala por épicos)
- Adicionar:
  - `epic-orchestration.yaml`
  - `development-cycle.yaml`
- Objetivo: paralelizar com gate de integração.

---

## 4) Recomendação para o seu cenário atual

Você já opera bem em:
- issue-driven delivery
- validação de PR/checks
- fechamento operacional

Próximos passos de maior impacto:
1. Tornar `spec-pipeline` obrigatório para itens STANDARD/COMPLEX.
2. Usar `story-development-cycle` como padrão para toda story de ciclo.
3. Reservar `qa-loop` para issues com rejeição em review.
4. Aplicar `epic-orchestration` apenas quando houver 3+ stories com dependências.

---

## 5) Limites e cuidados

- Não automatizar sem gate humano final (merge/aprovação).
- Não rodar pipeline completo em tasks triviais (custo > benefício).
- Evitar contexto excessivo por tarefa (use progressive disclosure).

---

## 6) Check rápido de decisão (qual workflow usar?)

- Bug simples/hotfix: ciclo enxuto + validação determinística
- Story padrão: `story-development-cycle`
- Story complexa: `spec-pipeline` + `story-development-cycle`
- Épico com múltiplas frentes: `epic-orchestration`
- Reprovação recorrente em QA: `qa-loop`
