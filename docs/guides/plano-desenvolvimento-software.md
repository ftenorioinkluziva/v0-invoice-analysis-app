# Plano de Desenvolvimento de Software — Linear + Claude Code + AIOX

## Visão Geral

Este documento unifica todas as ferramentas, processos e agentes em um fluxo operacional concreto para desenvolvimento de software solo (ou equipe pequena) com IA.

**Stack de Processo:**

| Camada | Ferramenta | Papel |
|--------|-----------|-------|
| Gestão de trabalho | Linear | Fonte de verdade para issues, ciclos, projetos |
| Especificação | Linear + Templates | Spec Pack dentro da issue |
| Execução | Claude Code | Motor de implementação |
| Orquestração | AIOX Agents | Agentes especializados por fase |
| Qualidade | Gates automáticos | Lint, typecheck, testes, build |
| Entrega | Git + GitHub | PRs, merge, deploy |

---

## 1) Princípios Operacionais

1. **Linear é a fonte de verdade** — todo trabalho começa e termina como issue no Linear.
2. **Spec antes de código** — nenhuma issue entra em execução sem Spec Pack completo.
3. **Agentes como especialistas** — cada fase do pipeline usa o agente AIOX adequado.
4. **Progressive Disclosure** — cada sessão Claude Code recebe apenas o contexto da task atual.
5. **Gates determinísticos** — qualidade validada por automação, não por opinião.
6. **Humano no controle final** — merge, deploy e aceite são decisão humana.

---

## 2) Pipeline Completo

```
┌─────────────────────────────────────────────────────────┐
│                    LINEAR (gestão)                       │
│                                                         │
│  ┌──────┐    ┌─────────┐    ┌──────┐    ┌───────────┐  │
│  │Triage│───>│ Backlog  │───>│ Todo │───>│In Progress│  │
│  └──┬───┘    └────┬────┘    └──┬───┘    └─────┬─────┘  │
│     │             │            │              │         │
│     │             │            │              │         │
│  ┌──────────────────────────────────────────────────┐   │
│  │             CLAUDE CODE (execução)               │   │
│  │                                                  │   │
│  │  @po            @po           @pm       @dev     │   │
│  │  *triage-       *groom-       *plan-    implementa│  │
│  │  linear         backlog       cycle              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌───────────┐    ┌──────┐                              │
│  │ In Review │───>│ Done │                              │
│  └─────┬─────┘    └──────┘                              │
│        │                                                │
│   @qa gate                                              │
│   @devops push + PR                                     │
│   Humano: merge                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3) Fases Detalhadas

### Fase 1: Triage

**Quando:** Issues novas aparecem no Linear (criadas por você, stakeholders, ou automações).

**Quem:** `@po *triage-linear {team}`

**O que acontece:**
1. Busca todas as issues com estado "Triage" no Linear
2. Classifica cada issue: tipo (bug/feature/refactor/tech-debt/spike), prioridade (1-4)
3. Aplica labels e move para Backlog ou direto para Todo (urgências)
4. Cancela duplicatas ou itens irrelevantes com comentário

**Resultado:** Triage vazio. Issues classificadas no Backlog.

**Frequência:** Diária (início do dia) ou sob demanda.

---

### Fase 2: Refinamento (Grooming)

**Quando:** Antes do planejamento do cycle, ou quando o backlog acumula issues sem spec.

**Quem:** `@po *groom-backlog {team}`

**O que acontece:**
1. Busca todas as issues em "Backlog"
2. Avalia cada issue contra 8 critérios de DoR (score /12)
3. Issues com score >= 8 recebem label "ready"
4. Issues com gaps recebem comentário com o que falta
5. Opção de completar spec interativamente (story + AC + spec técnica)

**Definition of Ready (DoR) — 8 critérios:**

| # | Critério | Peso |
|---|----------|------|
| 1 | Problema e objetivo claros | 2 |
| 2 | Story formato usuário (Como/Quero/Para) | 2 |
| 3 | Critérios de aceite (Given/When/Then) | 3 |
| 4 | Requisitos não funcionais | 1 |
| 5 | Dependências mapeadas | 1 |
| 6 | Riscos identificados | 1 |
| 7 | Estratégia de validação | 1 |
| 8 | Estimativa de esforço | 1 |

**Threshold:** Score >= 8/12 para ser considerado Ready.

**Resultado:** Issues marcadas como "ready" estão prontas para entrar no cycle.

**Frequência:** 1-2x por semana, ou antes de cada cycle planning.

---

### Fase 3: Planejamento do Cycle

**Quando:** Início de cada cycle (sprint).

**Quem:** `@pm *plan-cycle {team}`

**O que acontece:**
1. Identifica o cycle ativo e capacidade disponível
2. Lista issues "ready" no Backlog
3. Rankeia por prioridade + eficiência + idade
4. Propõe seleção que respeita capacidade
5. Após aprovação, move issues para o cycle com estado "Todo"

**Resultado:** Cycle populado. Escopo definido. Trabalho pronto para começar.

**Frequência:** A cada início de cycle.

---

### Fase 4: Implementação

**Quando:** Issue está no cycle com estado "Todo" ou "In Progress".

**Quem:** `@dev *start {issue_id}` (via Claude Code)

**O que acontece automaticamente:**
1. Puxa o conteúdo completo da issue do Linear (via MCP)
2. Extrai o Spec Pack da description (story, AC, spec técnica, validação)
3. Avalia completude do spec (COMPLETE / PARTIAL / MINIMAL)
4. Cria branch a partir do contexto da issue (ex: `feat/nw-42-add-export-pdf`)
5. Marca issue como "In Progress" no Linear
6. Apresenta todo o contexto na sessão

**Exemplo:**
```
User: @dev *start NW-42
Dev:  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ISSUE: NW-42 — Adicionar export PDF
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Priority: High | Estimate: 3 | Branch: feat/nw-42-add-export-pdf

      OBJETIVO
      Permitir que o usuário exporte relatório de gastos em PDF

      STORY
      Como usuário, eu quero exportar meus dados em PDF, para
      compartilhar com meu contador.

      CRITÉRIOS DE ACEITE
      Given usuário está no dashboard
      When clica em "Exportar PDF"
      Then download do PDF inicia com dados do período selecionado

      VALIDAÇÃO
      - npm run lint
      - npm run test
      - npm run build
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Contexto carregado. Pronto para implementar?
```

**Fluxo de implementação (após contexto carregado):**
```
@dev com spec pack na sessão
  │
  ├─ 1. Ler código existente (entender contexto)
  ├─ 2. Implementar incrementalmente (pequenos commits)
  ├─ 3. Rodar lint + typecheck a cada mudança
  ├─ 4. Escrever/atualizar testes
  └─ 5. Rodar testes
```

**Regras do @dev:**
- Pode: `git add`, `git commit`, `git branch`, `git checkout`
- Não pode: `git push`, `gh pr create` (exclusivo do @devops)
- Não pode: alterar AC, escopo ou título da story

---

### Fase 5: Validação (Quality Gate)

**Quando:** Implementação completa, antes do PR.

**Quem:** `@qa` (via Claude Code)

**7 checks obrigatórios:**

| # | Check | Comando | Bloqueante |
|---|-------|---------|------------|
| 1 | Lint | `npm run lint` | Sim |
| 2 | Typecheck | `npx tsc --noEmit` | Sim |
| 3 | Testes unitários | `npm run test` | Sim |
| 4 | Testes E2E | `npm run test:e2e` | Não (se aplicável) |
| 5 | Build | `npm run build` | Sim |
| 6 | Critérios de aceite | Verificação manual contra AC | Sim |
| 7 | Sem regressões | Diff review | Sim |

**Verdicts:**
- **PASS** — todos checks verdes, AC atendidos
- **CONCERNS** — checks verdes, mas riscos observados
- **FAIL** — checks vermelhos ou AC não atendidos → volta para @dev

**Se FAIL:** QA Loop (max 5 iterações):
```
@qa review → FAIL → @dev fix → @qa re-review → ... → PASS
```

---

### Fase 6: Entrega (Push + PR)

**Quando:** QA Gate passou (PASS ou CONCERNS).

**Quem:** `@devops` (exclusivo)

**Fluxo:**
```
@devops
  │
  ├─ 1. git push -u origin {branch}
  ├─ 2. gh pr create --title "..." --body "..."
  ├─ 3. Aguardar CI checks
  └─ 4. Atualizar Linear → "In Review"
```

**Template de PR:**
```markdown
## Summary
- {1-3 bullet points do que foi feito}

## Linear Issue
- {PROJ-123: título}

## Test Plan
- [ ] Lint/typecheck green
- [ ] Unit tests pass
- [ ] E2E tests pass (if applicable)
- [ ] AC verified

## Spec Pack
- Story: {resumo}
- AC: {link ou inline}
```

**Atualizar Linear:**
```yaml
action: save_issue
params:
  id: "PROJ-123"
  state: "In Review"
```

---

### Fase 7: Revisão Humana + Merge

**Quando:** PR criado, CI checks verdes.

**Quem:** Você (humano).

**Checklist de revisão:**
- [ ] Diff coerente com o escopo da issue
- [ ] Sem over-engineering ou código desnecessário
- [ ] Critérios de aceite realmente atendidos
- [ ] Sem secrets, credenciais ou dados sensíveis
- [ ] Branch atualizada com main, sem conflitos

**Após merge:**
```yaml
action: save_issue
params:
  id: "PROJ-123"
  state: "Done"

action: save_comment
params:
  issueId: "PROJ-123"
  body: |
    ## Entrega concluída

    ### O que foi implementado
    - {resumo}

    ### Validação
    - Lint/typecheck/testes: OK
    - Build: OK
    - AC atendidos: sim

    ### Observações
    - {riscos residuais ou próximos passos}
```

---

## 4) Mapa de Agentes por Fase

| Fase | Agente AIOX | Comando | MCP Tools Usadas |
|------|-------------|---------|------------------|
| Triage | @po | `*triage-linear` | list_issues, save_issue, save_comment |
| Grooming | @po | `*groom-backlog` | list_issues, save_issue, save_comment, get_issue |
| Cycle Planning | @pm | `*plan-cycle` | list_issues, list_cycles, save_issue |
| Spec técnica | @architect | (manual) | — |
| Implementação | @dev | `*start {issue_id}` | get_issue, save_issue, list_comments |
| Quality Gate | @qa | (manual) | — |
| Push + PR | @devops | (manual) | — |
| Merge | Humano | — | save_issue, save_comment |

---

## 5) Progressive Disclosure — Como Alimentar o Claude Code

### Regra: 1 sessão = 1 issue

O comando `@dev *start {issue_id}` automatiza o carregamento de contexto:

1. Puxa a issue do Linear via MCP (título, description, labels, relações)
2. Extrai o Spec Pack da description (story, AC, spec técnica)
3. Avalia completude e avisa se algo está faltando
4. Apresenta tudo formatado na sessão

Isso elimina o trabalho manual de copiar/colar specs do Linear.

### Se a issue não tem spec na description

O `*start` detecta e oferece opções:
- **COMPLETE** (objetivo + AC presentes) → segue direto
- **PARTIAL** (objetivo sem AC) → avisa e oferece ajuda para completar
- **MINIMAL** (só título) → alerta forte, sugere voltar para grooming

### Ao trocar de issue
1. Iniciar sessão limpa (`/clear` ou nova conversa)
2. Rodar `@dev *start {nova_issue_id}`
3. Nunca carregar histórico de issues anteriores

### Contexto manual (fallback)

Se por algum motivo o MCP não estiver disponível, fornecer manualmente:

```
## Issue
PROJ-123: {título}

## Objetivo
{1 frase clara}

## Critérios de Aceite
Given {contexto} When {ação} Then {resultado}

## Validação
npm run lint && npm run test && npm run build
```

---

## 6) Cadência Operacional

### Diário
| Horário | Ação | Comando |
|---------|------|---------|
| Início do dia | Triage de novas issues | `@po *triage-linear {team}` |
| Durante o dia | Implementar 1-3 issues do cycle | `@dev` + Claude Code |
| Fim do dia | Push do trabalho feito | `@devops` push + PR |

### Semanal
| Dia | Ação | Comando |
|-----|------|---------|
| Segunda | Grooming do backlog | `@po *groom-backlog {team}` |
| Segunda | Planejamento do cycle (se novo cycle) | `@pm *plan-cycle {team}` |
| Sexta | Revisão de PRs pendentes | Humano |
| Sexta | Retrospectiva rápida | Revisar KPIs |

### Por Cycle
| Momento | Ação |
|---------|------|
| Início | `@pm *plan-cycle` → popular cycle |
| Meio | Verificar progresso, re-priorizar se necessário |
| Fim | Fechar issues Done, mover incompletas para backlog |

---

## 7) Definition of Done (DoD)

Uma issue só pode ser marcada como "Done" se:

- [ ] Critérios de aceite cumpridos (verificados por @qa)
- [ ] Lint e typecheck sem erros
- [ ] Testes relevantes passando
- [ ] Build sem erros
- [ ] PR aprovado e merged
- [ ] Issue atualizada no Linear com evidência
- [ ] Plano de rollback conhecido (quando aplicável)

---

## 8) KPIs

| KPI | O que mede | Meta inicial |
|-----|-----------|-------------|
| Lead Time | Tempo de Backlog → Done | < 5 dias |
| Throughput | Issues Done por cycle | Baseline + 10% |
| Taxa de Retrabalho | Issues que voltam de Review para In Progress | < 15% |
| DoR Compliance | % de issues que entram no cycle com Ready completo | > 90% |
| CI Pass Rate | % de PRs com checks verdes na primeira tentativa | > 80% |
| QA First-Pass Rate | % de issues que passam no QA Gate sem iteração | > 70% |

---

## 9) Anti-padrões

| Anti-padrão | Por que é ruim | O que fazer |
|-------------|---------------|-------------|
| Implementar sem spec | Retrabalho, escopo indefinido | Sempre completar Spec Pack antes |
| Contexto excessivo no Claude | Respostas imprecisas, tokens desperdiçados | Progressive Disclosure: 1 issue por sessão |
| Ignorar check vermelho | Bugs em produção | Gate é bloqueante, corrigir antes de prosseguir |
| Fechar issue sem evidência | Impossível auditar qualidade | Comentário de fechamento obrigatório |
| Pular grooming | Issues mal definidas entram no cycle | Grooming semanal obrigatório |
| @dev fazendo push | Viola autoridade do @devops | Sempre delegar push/PR para @devops |
| Merge sem revisão humana | IA pode introduzir bugs sutis | Humano sempre revisa o diff |
| Cycle sem capacidade definida | Over-commitment, burnout | Definir capacidade antes de planejar |

---

## 10) Ferramentas e Dependências

### Obrigatórias

| Ferramenta | Propósito | Configuração |
|-----------|-----------|-------------|
| Linear | Gestão de issues, cycles, projects | Conta + team configurado |
| Linear MCP | Integração Claude Code ↔ Linear | Plugin MCP habilitado |
| Claude Code | Motor de implementação | CLI ou VS Code extension |
| Git + GitHub | Versionamento e PRs | Repositório configurado |
| Node.js | Runtime | v18+ |

### Recomendadas

| Ferramenta | Propósito |
|-----------|-----------|
| AIOX Framework | Agentes especializados |
| Playwright MCP | Testes E2E via browser |
| Vitest | Testes unitários |

---

## 11) Quick Reference — Comandos do Dia

```bash
# Triage (início do dia)
@po *triage-linear NoteWise

# Grooming (semanal)
@po *groom-backlog NoteWise

# Planejar cycle (início de sprint)
@pm *plan-cycle NoteWise

# Implementar issue (durante o dia)
@dev *start NW-42

# Quality gate (antes do PR)
npm run lint && npx tsc --noEmit && npm run test && npm run build

# Push e PR (fim do dia)
# → @devops faz push e cria PR

# Fechar issue (após merge)
# → comentário de fechamento no Linear
```

---

## 12) Evolução do Processo

Este plano é um ponto de partida. Evoluir com base nos KPIs:

| Se observar... | Ajustar... |
|----------------|-----------|
| Lead time alto | Reduzir tamanho das issues, aumentar frequência de triage |
| Retrabalho alto | Investir mais tempo no grooming e AC |
| CI failures frequentes | Reforçar quality gate antes do push |
| Cycle incompleto | Reduzir capacidade planejada ou melhorar estimativas |
| Issues sem spec entrando | Tornar DoR gate mais rigoroso |

---

*Documento vivo — atualizar conforme o processo amadurece.*
