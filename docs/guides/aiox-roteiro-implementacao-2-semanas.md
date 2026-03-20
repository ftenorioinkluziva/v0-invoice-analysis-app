# Roteiro de Implementação em 2 Semanas — AIOX no projeto

## Objetivo
Adotar a orquestração da `.aiox-core` sem travar a entrega diária, começando pelo que gera mais impacto com menor risco.

## Resultado esperado ao final de 2 semanas
- Workflow padrão por story estabelecido
- Gate de especificação ativo para itens médios/complexos
- Loop de QA para correções recorrentes
- Critérios claros para quando usar orquestração de épico
- Métricas iniciais para ajustar o processo

---

## Semana 1 — Padronizar execução e qualidade

### Dia 1 — Baseline operacional
Objetivo:
- Definir ponto de partida (como o time trabalha hoje)

Ações:
1. Confirmar estrutura de fluxo no Linear:
   - Triage
   - Backlog
   - Todo
   - In Progress
   - In Review
   - Done
2. Definir labels oficiais (tipo, domínio, risco, urgência)
3. Publicar templates mínimos:
   - Story + Gherkin
   - Critérios de aceite
   - DoD

Saída:
- Processo documentado e visível para o time

---

### Dia 2 — Ativar ciclo padrão de story
Objetivo:
- Tornar o ciclo de story repetível

Workflow foco:
- [story-development-cycle.yaml](.aiox-core/development/workflows/story-development-cycle.yaml)

Ações:
1. Executar o ciclo em 1 story real de baixa complexidade
2. Verificar passagem pelas fases:
   - criação
   - validação
   - implementação
   - review QA
3. Ajustar checklist de validação de story ao contexto do projeto

Saída:
- 1 story entregue usando ciclo completo

---

### Dia 3 — Consolidar ciclo dev + quality gate
Objetivo:
- Formalizar o caminho técnico até PR

Workflow foco:
- [development-cycle.yaml](.aiox-core/development/workflows/development-cycle.yaml)

Ações:
1. Configurar uso para stories aprovadas
2. Confirmar executor e quality gate distintos por story
3. Garantir checkpoints antes de push/PR

Saída:
- Fluxo técnico com gate de qualidade por story

---

### Dia 4 — Definir padrão determinístico de validação
Objetivo:
- Padronizar validação para reduzir regressão

Ações:
1. Criar matriz de validação por tipo de tarefa:
   - UI: testes relevantes + checks de build/deploy
   - API: testes de contrato/integridade
   - Dados: validações de migração e rollback
2. Padronizar DoD com evidência obrigatória

Saída:
- Checklist único para aceitar merge

---

### Dia 5 — Pilotar QA loop em caso real
Objetivo:
- Automatizar correção iterativa sem perder controle

Workflow foco:
- [qa-loop.yaml](.aiox-core/development/workflows/qa-loop.yaml)

Ações:
1. Aplicar em 1 PR com feedback de ajuste
2. Rodar ciclo review → fix → re-review
3. Definir gatilho de escalonamento para humano

Saída:
- Procedimento de correção iterativa definido

---

## Semana 2 — Fortalecer especificação e escalar

### Dia 6 — Ativar spec-first para itens médios/complexos
Objetivo:
- Melhorar qualidade da entrada

Workflow foco:
- [spec-pipeline.yaml](.aiox-core/development/workflows/spec-pipeline.yaml)

Ações:
1. Definir regra:
   - SIMPLE: execução direta com story validada
   - STANDARD/COMPLEX: obrigatório passar no spec pipeline
2. Rodar pipeline completo em 1 item STANDARD

Saída:
- Gate de especificação ativo

---

### Dia 7 — Aplicar Progressive Disclosure na operação
Objetivo:
- Reduzir dispersão de contexto e alucinação

Ações:
1. Definir pacote padrão de contexto por task:
   - objetivo único
   - arquivos alvo
   - critérios de aceite
   - comandos de validação
2. Limpar contexto entre tarefas não relacionadas

Saída:
- Menos ruído de contexto por execução

---

### Dia 8 — Integrar fluxo com Projects e Cycles
Objetivo:
- Conectar governança (Linear) com execução (AIOX)

Ações:
1. Definir quando issue vai para Cycle (somente Ready)
2. Definir quando vira Project (iniciativa maior com milestones)
3. Publicar regra de priorização do backlog

Saída:
- Governança e execução sincronizadas

---

### Dia 9 — Definir regra de escala para épicos
Objetivo:
- Escalar com segurança quando houver muitas stories dependentes

Workflow foco:
- [epic-orchestration.yaml](.aiox-core/development/workflows/epic-orchestration.yaml)

Ações:
1. Definir critérios de uso:
   - 3 ou mais stories com dependências
   - necessidade de paralelismo
2. Definir gate de integração entre waves

Saída:
- Regra objetiva para ativar orquestração de épico

---

### Dia 10 — Fechamento, métricas e melhoria contínua
Objetivo:
- Tornar o processo sustentável

Ações:
1. Revisar KPIs da quinzena:
   - lead time
   - throughput
   - retrabalho pós-review
   - falhas de CI por tipo
2. Ajustar templates e gates
3. Publicar versão final do playbook operacional

Saída:
- Processo estabilizado e com ciclo de melhoria

---

## Regras de decisão (resumo rápido)

- Bug simples/hotfix:
  - Story validada + development cycle
- Story padrão:
  - story development cycle
- Story complexa:
  - spec pipeline + story/development cycle
- Reprovação recorrente:
  - qa loop
- Épico com paralelismo:
  - epic orchestration

---

## Critérios de sucesso no fim das 2 semanas

- 80% ou mais das stories seguindo ciclo padrão
- 100% das stories STANDARD/COMPLEX com spec antes da implementação
- Queda de retrabalho em review
- Queda de falhas evitáveis de CI
- Melhoria perceptível na previsibilidade de entrega

---

## Próximo passo recomendado (semana 3)

- Automatizar score de prontidão de issue (Ready score)
- Criar dashboard simples de qualidade do fluxo
- Refinar gatilhos de quando usar cada workflow por tipo de trabalho
