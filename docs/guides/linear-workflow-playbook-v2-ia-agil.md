# Playbook V2 — Linear + IA-Ágil (Spec-First + Entrega Determinística)

## Objetivo
Combinar o melhor de dois mundos:
- **Spec-first** (clareza, previsibilidade, menos retrabalho)
- **Execução enxuta** (entrega rápida, feedback contínuo)

Este playbook define um fluxo para operar com IA como motor de implementação, mantendo validações determinísticas e aprovação humana final.

---

## 1) Princípios

1. **Spec vem antes de código**: para cada tarefa, especificação mínima obrigatória.
2. **Task unitária e homogênea**: cada execução deve ter escopo pequeno e claro.
3. **Progressive Disclosure**: fornecer à IA apenas o contexto necessário para aquela task.
4. **Determinismo sobre probabilidade**: qualidade validada por gates automáticos.
5. **Humano no controle final**: merge e aceite sempre com revisão humana.

---

## 2) Hierarquia no Linear

- **Triage**: entrada única de demanda.
- **Backlog**: itens validados e priorizados, sem execução imediata.
- **Cycle**: trabalho atual (somente itens Ready).
- **Project**: iniciativa maior com milestones e metas.

Fluxo padrão:
`Triage → Backlog → Todo (Cycle) → In Progress → In Review → Done`

---

## 3) Gate de entrada (Definition of Ready)

Uma issue só entra no ciclo se tiver:
- Problema e objetivo claros
- Story em formato de usuário (incluindo benefício)
- Critérios de aceite mensuráveis
- Requisitos não funcionais aplicáveis (performance, segurança, UX, custo)
- Dependências e riscos mapeados
- Estratégia de validação definida

---

## 4) Pacote mínimo de especificação (Spec Pack)

Para cada issue pronta para execução, anexar:

1. **Story (negócio)**
   - Como [perfil], eu quero [ação], para [benefício]

2. **Critérios de aceite (Gherkin)**
   - Cenários Given/When/Then

3. **Spec técnica curta (1 página)**
   - Escopo de arquivos e módulos
   - Contratos (API/eventos)
   - Dados (entidades/campos/regras)
   - Riscos + rollback

4. **DoD (Definition of Done)**
   - Lista objetiva de verificação final

---

## 5) Template de Story + Gherkin

## Story
Como [tipo de usuário],
eu quero [capacidade],
para [resultado de negócio].

## Cenários (Gherkin)
### Cenário 1: caminho principal
Given [contexto inicial]
When [ação executada]
Then [resultado esperado]

### Cenário 2: erro/limite
Given [condição de borda]
When [ação executada]
Then [comportamento de proteção]

---

## 6) Template de Spec técnica curta

## Contexto
- Problema técnico atual
- Restrições relevantes

## Mudança proposta
- Componentes/rotas/módulos afetados
- Contratos alterados (request/response/eventos)

## Dados
- Entidades/campos impactados
- Migração necessária? (sim/não)

## Estratégia de validação
- Testes unitários
- Testes integração/e2e
- Critérios de observabilidade

## Riscos e rollback
- Risco principal
- Plano de reversão

---

## 7) Pipeline de execução IA-Ágil (task-centric)

### Etapa A — Triage
- Classificar: `bug`, `feature`, `refactor`, `tech-debt`, `spike`
- Decisão: cancelar, backlog, ou ciclo

### Etapa B — Refinamento
- Completar Spec Pack
- Verificar gate de Ready

### Etapa C — Implementação assistida por IA
- Task unitária
- Contexto mínimo necessário
- Execução incremental (pequenos commits)

### Etapa D — Validação determinística
- Lint
- Typecheck
- Testes relevantes
- Build/deploy checks

### Etapa E — Revisão humana
- Revisar diff, riscos e critérios de aceite
- Validar comportamento final

### Etapa F — Merge e fechamento
- Merge com checks verdes
- Atualizar issue e changelog
- Registrar aprendizado no playbook

---

## 8) Progressive Disclosure operacional

Para cada task, informar à IA somente:
- 1 objetivo
- 1 escopo de arquivos
- critérios de aceite da issue
- comandos de validação necessários

Evitar enviar histórico extenso de tarefas não relacionadas.

### Regra de ouro
- Mudou de tarefa => limpar contexto da conversa e iniciar com novo pacote objetivo + arquivos.

---

## 9) Definition of Done (DoD)

- [ ] Critérios de aceite cumpridos
- [ ] Lint e typecheck ok
- [ ] Testes relevantes ok
- [ ] Deploy/checks verdes
- [ ] PR sem comentários pendentes
- [ ] Issue atualizada com evidência
- [ ] Plano de rollback conhecido (quando aplicável)

---

## 10) Checklist de PR pronto para merge

- [ ] Branch atualizada com `main`
- [ ] Sem conflitos
- [ ] Checks obrigatórios verdes
- [ ] Escopo aderente à issue (sem over-engineering)
- [ ] Aprovação humana concluída

---

## 11) KPIs recomendados

- Lead time (`Backlog → Done`)
- Throughput por cycle
- Taxa de retrabalho pós-review
- % de issues que entram no ciclo sem Ready completo
- % de falhas de CI por tipo (lint, typecheck, teste, deploy)

---

## 12) Papéis (com IA especialista)

- **PO/PM**: define problema, priorização e critérios de valor
- **Architect**: define desenho técnico e trade-offs
- **Dev**: implementa e valida
- **QA**: testa risco e regressão
- **DevOps**: CI/CD e release
- **Humano responsável**: decisão final de merge

---

## 13) Plano de adoção em 30 dias

### Semana 1
- Implantar templates de Story, Gherkin e Spec técnica curta

### Semana 2
- Tornar Ready obrigatório para entrar no cycle

### Semana 3
- Padronizar pipeline determinístico por tipo de tarefa

### Semana 4
- Medir KPIs e ajustar processo com base em dados

---

## 14) Anti-padrões

- Executar task sem critérios de aceite
- Enviar contexto excessivo e difuso para IA
- Ignorar check vermelho para “ganhar tempo”
- Fechar issue sem evidência de validação
- Tratar IA como autora final (sem validação humana)

---

## 15) Template de comentário de fechamento de issue

```md
✅ Entrega concluída

### O que foi implementado
- ...

### Validação
- Lint/typecheck/testes/deploy: ...

### Resultado
- Critérios de aceite atendidos: sim/não

### Observações
- Riscos residuais / próximos passos
```
