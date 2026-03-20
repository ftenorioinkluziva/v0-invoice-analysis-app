# Playbook de Workflow — Linear + GitHub + Vercel

## Objetivo
Padronizar o fluxo de ponta a ponta: da entrada de demandas até merge em produção, com qualidade e rastreabilidade.

## 1) Hierarquia de trabalho

### Triage (entrada)
Tudo começa aqui: bug, feature, melhoria técnica, ajuste visual, débito técnico.

**Regras:**
- Toda nova demanda entra em `Triage`.
- Em triagem, decidir: `Cancelar`, `Backlog` ou `Cycle`.
- Nada vai direto para execução sem triagem.

### Backlog (validadas, sem execução imediata)
Itens aceitos e priorizados, mas fora do ciclo atual.

**Regras:**
- Backlog deve estar sempre ordenado por prioridade.
- Usar labels consistentes para facilitar filtro e planejamento.

### Cycles (execução agora)
Equivalente ao sprint contínuo: foco em entrega imediata.

**Regras:**
- Só entra no ciclo o que está **Ready**.
- Limitar WIP por pessoa (1–2 issues simultâneas).
- Itens bloqueados por mais de 48h devem ser replanejados.

### Projects (iniciativas maiores)
Agrupam entregas de médio/longo prazo com milestones, dono e prazo.

**Regras:**
- Use Project quando houver objetivo maior com várias issues relacionadas.
- Issues do Project podem ser distribuídas entre diferentes Cycles.

---

## 2) Estados recomendados no Linear

- `Triage`
- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

Fluxo padrão:
`Triage → Backlog → Todo (Cycle) → In Progress → In Review → Done`

---

## 3) Definição de Ready (gate para entrar no Cycle)

Uma issue só entra em execução se tiver:
- Problema claro
- Objetivo claro
- Escopo técnico definido
- Critérios de aceite testáveis
- Dependências mapeadas
- Sem bloqueio externo imediato

---

## 4) Convenção de labels

### Tipo
- `bug`
- `feature`
- `refactor`
- `tech-debt`
- `spike`

### Domínio
- `frontend`
- `backend`
- `data`
- `infra`
- `ai-agent`

### Risco
- `risk-low`
- `risk-medium`
- `risk-high`

### Urgência
- `urgent`
- `normal`
- `low`

**Regra prática:** usar no máximo 3–5 labels por issue.

---

## 5) Template de issue (Linear)

## Problema
Descreva a dor atual e onde ela ocorre.

## Objetivo
Descreva o resultado esperado.

## Escopo técnico
Liste arquivos/áreas afetadas e abordagem.

## Fora de escopo
Deixe explícito o que não será feito.

## Critérios de aceite
- [ ] Critério 1 (mensurável)
- [ ] Critério 2 (mensurável)
- [ ] Critério 3 (mensurável)

## Validação
- [ ] Teste local executado
- [ ] Cenário principal validado
- [ ] Sem regressão observada

---

## 6) Execução (Dev workflow)

1. Escolher issue no `Cycle` com status `Todo`.
2. Mover para `In Progress`.
3. Implementar mudança mínima necessária.
4. Rodar validações relevantes (testes, build/checks aplicáveis).
5. Abrir PR com referência da issue.
6. Mover issue para `In Review`.

---

## 7) Checklist de PR pronto para merge

- [ ] Branch atualizada com `main`
- [ ] Sem conflitos
- [ ] Checks obrigatórios verdes (CI/Vercel/testes)
- [ ] Sem comentários pendentes de revisão
- [ ] Critérios de aceite atendidos
- [ ] Issue Linear atualizada

---

## 8) Definição de Done

Uma issue só vai para `Done` quando:
- PR mergeado
- Checks obrigatórios em sucesso
- Sem pendências de revisão
- Comentário final publicado na issue (resumo técnico + validação)

---

## 9) Cadência recomendada (rituais)

### Diário (10–15 min)
- Revisar `Triage`
- Atualizar bloqueios em `In Progress`

### Semanal
- Planejamento de Cycle (Seg/Ter)
- Health check de Cycle (Qua)
- Review + limpeza de backlog (Sex)

---

## 10) Operação com GitHub + Vercel

### GitHub
- PR deve referenciar issue Linear.
- Revisar `reviews`, `comments` e `check runs` antes do merge.

### Vercel
- Deploy preview deve estar verde para merge.
- Se falhar, corrigir causa raiz (ex.: lockfile, env, build).

---

## 11) KPIs mínimos para acompanhar

- Lead time (`Backlog → Done`)
- Throughput por cycle
- Aging em `In Progress`
- Carry-over entre cycles
- Taxa de reabertura de bugs

---

## 12) Anti-padrões para evitar

- Issue vaga sem critérios de aceite
- Iniciar execução sem triagem
- WIP alto com muitas issues abertas
- PR com check vermelho sendo forçado para merge
- Mover para `Done` sem merge real

---

## 13) Exemplo de fluxo completo (resumido)

1. Demanda entra em `Triage`
2. É aceita e vai para `Backlog`
3. No planejamento entra no `Cycle` (`Todo`)
4. Desenvolvimento (`In Progress`)
5. PR aberta e validações (`In Review`)
6. CI/Vercel verdes
7. Merge
8. Issue atualizada e `Done`

---

## 14) Template de comentário de fechamento (issue)

```md
✅ Entrega concluída

### O que foi implementado
- ...
- ...

### Arquivos principais
- ...
- ...

### Validação
- Testes/checks executados: ...
- Resultado: ...

### Observações
- ...
```

---

## 15) Adaptação rápida para outros projetos

- Manter a hierarquia (`Triage > Backlog > Cycle > Project`).
- Ajustar labels por domínio do produto.
- Manter os gates de `Ready` e `Done`.
- Não abrir exceção para checks vermelhos.
- Sempre fechar loop operacional (issue + PR + status + deploy).
