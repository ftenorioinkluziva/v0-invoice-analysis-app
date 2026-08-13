# PRD - NoteWise (v0 Invoice Analysis App)

**Versão:** 1.0
**Data:** 2026-04-16
**Tipo:** Brownfield (projeto existente)
**Status:** Draft

---

## 1. Visão do Produto

**Nome:** NoteWise
**Tipo:** Mobile-first webapp
**Resumo:** Aplicativo brasileiro de análise de notas fiscais. Usuários enviam PDFs de notas fiscais, a IA extrai dados estruturados, e o app rastreia gastos e histórico de preços.
**Usuários Alvo:** Consumidores brasileiros que desejam controlar gastos com compras em supermercados, farmácias, etc.

---

## 2. Estado Atual do Projeto

### Stack Tecnológico
- **Frontend:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** Neon Postgres (raw SQL, sem ORM)
- **Auth:** Better-auth v1 (email/password + Google OAuth)
- **AI:** OpenRouter com `google/gemini-2.5-flash` via AI SDK 7
- **Testing:** Vitest (unit) + Playwright (E2E)

### Funcionalidades Implementadas
| Funcionalidade | Status | Observações |
|----------------|--------|-------------|
| Upload de PDF | ✅ | Extração via Gemini vision |
| Dashboard | ✅ | Stats, gráficos, alertas |
| Histórico de preços | ✅ | Por produto |
| Listas de compras | ✅ | CRUD completo |
| Alertas de preço | ✅ | Threshold padrão 15% |
| Configurações | ✅ | Preferências, dados |
| Auth | ✅ | Email + Google OAuth |
| RLS | ✅ | Isolamento por user_id |

### Rotas Principais
- `/` — Dashboard
- `/historico` — Histórico de preços
- `/lista` — Listas de compras
- `/alertas` — Alertas de preço
- `/config` — Configurações
- `/sign-in`, `/sign-up` — Autenticação

---

## 3. Requisitos Funcionais

### 3.1 Extração de Invoice (PDF)
- Envio de PDF ou imagem da nota fiscal
- Extração de dados via Gemini 2.5 Flash
- Schema: store, items, total, date, invoice_number
- Preview antes de salvar
- Normalização de produtos (lowercase, remover unidades)

### 3.2 Dashboard
- Total gasto no mês
- Variação percentual vs mês anterior
- Total de notas processadas
- Índice de inflação (média de aumentos)
- Gráfico de gastos por mês (área)
- Alertas recentes
- Notas recentes (loja, data, valor)

### 3.3 Histórico de Preços
- Lista de produtos comprados
- Busca e filtro por categoria
- Contagem de compras
- Preço médio
- Última compra
- Detalhe: histórico de 20 compras com preço/data/loja

### 3.4 Listas de Compras
- Criar lista com nome
- Adicionar produtos (busca no banco)
- Marcar itens como comprados
- Status: active, completed, archived

### 3.5 Alertas de Preço
- Tipos: price_increase, opportunity, restock
- Threshold configurável (padrão 15%)
- Marcar como lido
- Notificações (weekly summary opcional)

### 3.6 Configurações
- Limite de alerta personalizável
- Toggle notificações por tipo
- Exportar dados
- Deletar todos os dados

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance
- Extração de PDF < 10s
- Dashboard load < 2s
- Busca de produtos < 500ms

### 4.2 Segurança
- RLS ativo em todas tabelas
- Sessão via cookies seguros
- Dados sensíveis encriptados

### 4.3 UI/UX
- Mobile-first design
- Tema dark/light
- Português (pt-BR)
- Moeda: BRL (Intl.NumberFormat)

---

## 5. Arquitetura

### Camadas
```
app/          — Next.js pages
lib/          — DB client, types, validations, utils
components/   — UI components (shadcn + custom)
e2e/          — Playwright tests
```

### DB (Postgres, sem ORM)
- stores, products, invoices, invoice_items
- shopping_lists, shopping_list_items
- alerts, user_preferences

### API Routes
| Route | Métodos |
|-------|---------|
| `/api/extract-pdf` | POST |
| `/api/invoices` | GET, POST |
| `/api/analytics` | GET |
| `/api/products` | GET |
| `/api/products/[id]` | GET |
| `/api/shopping-lists` | GET, POST |
| `/api/shopping-lists/[id]` | GET, POST, PATCH |
| `/api/alerts` | GET, PATCH |
| `/api/preferences` | GET, PATCH |
| `/api/data` | DELETE |
| `/api/auth/[...all]` | * |

---

## 6. Riscos e Dependencies

### Riscos
- API key do Gemini pode expirar
- Rate limits do Neon serverless
- Dados históricos não migráveis

### Dependencies
- Google Generative AI API
- Neon Postgres
- Better-auth
- Vercel (deploy)

---

## 7. Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Usuários ativos | 100 |
| Notas processadas/dia | 50 |
| Taxa de extração sucesso | >95% |
| Tempo de extração médio | <8s |

---

## 8. Próximos Passos Sugeridos

1. **Melhorias na extração** — Campos adicionais na nota (CNPJ emitente, impostos)
2. **Relatórios mensais** — PDF summary enviado por email
3. **Integração marketplaces** — Comparar preços online
4. **Categorização IA** — Usar LLM para categorizar produtos
5. **Notificações push** — Service workers para mobile

---

*PRD gerado via processo PM (atuando como Morgan the Strategist)*
