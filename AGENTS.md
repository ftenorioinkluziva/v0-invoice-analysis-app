# AGENTS.md - NoteWise (v0 Invoice Analysis App)

## Project Structure

Single Next.js 16 app (not a monorepo). Key directories:
- `app/` — Next.js App Router pages
- `lib/` — Database client, types, validation schemas, utilities
- `components/` — UI components (shadcn/ui + custom)
- `e2e/` — Playwright E2E tests
- `docs/` — Stories and development guides

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit   # TypeScript check (no build)
npm test             # Vitest unit tests
npm run test:watch   # Vitest watch mode
npm run test:e2e    # Playwright E2E tests
npm run test:e2e:ui # Playwright E2E UI
```

## Quality Gates

Run in order before marking tasks complete:
1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`

## Environment Variables

```bash
DATABASE_URL="postgresql://..."              # Neon Postgres (required)
GOOGLE_GENERATIVE_AI_API_KEY="..."          # AI extraction (Gemini 2.5 Flash)
BETTER_AUTH_SECRET="..."                    # Auth sessions
GOOGLE_CLIENT_ID="..."                      # OAuth (optional)
GOOGLE_CLIENT_SECRET="..."                  # OAuth (optional)
```

## Key Architecture Facts

- **No ORM** — Raw SQL via `pg` pools and parameterized queries
- **AI Extraction** — Uses `ai` SDK with `Output.object(ExtractedInvoiceSchema)` for structured extraction
- **Auth** — Better-auth v1 with email/password + Google OAuth
- **RLS** — Strict `app.user_id` isolation; protected routes use `withUserTransaction(userId, operation)` so context and queries share one transaction
- **Language** — Portuguese (pt-BR); all UI strings should be in Portuguese
- **Monetary** — BRL only; use `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

## Where Business Logic Lives

- `lib/invoice-utils.ts` — Product normalization, categorization, unit extraction, price validation
- `lib/types.ts` — Zod schemas for AI extraction contract
- `lib/validations.ts` — API request validation schemas

## Protected Route Pattern

```typescript
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'

export async function GET(request: Request) {
  const userId = await getSessionUserId(request)
  return withUserTransaction(userId, async (client) => {
    // ... queries with RLS isolation on this client
  })
}
```

## Relevant Docs

- `CLAUDE.md` — Detailed architecture reference (database schema, API routes, components)
- `README.md` — E2E test setup with environment variables
