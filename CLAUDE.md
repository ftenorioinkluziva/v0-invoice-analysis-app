# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright E2E tests
npm run test:e2e:ui  # Playwright E2E with UI
```

## Environment Variables

```bash
DATABASE_URL="postgresql://..."              # Neon Postgres (required)
GOOGLE_GENERATIVE_AI_API_KEY="..."          # Google AI — usado para extração de PDF (gemini-2.5-flash)
BETTER_AUTH_SECRET="..."                    # better-auth session secret
GOOGLE_CLIENT_ID="..."                     # Google OAuth (optional)
GOOGLE_CLIENT_SECRET="..."                 # Google OAuth (optional)
```

## Architecture

**NoteWise** is a mobile-first Brazilian invoice (nota fiscal) analysis app. Users upload PDF invoices, the AI extracts structured data, and the app tracks spending and price history.

### Data Flow

```
PDF upload → POST /api/extract-pdf (Gemini 2.5 Flash via AI SDK)
           → structured ExtractedInvoice (validated with Zod)
           → user confirms preview dialog
           → POST /api/invoices (saves to Postgres)
           → price alert generation (>15% increase triggers alert)
```

### Key Layers

**`lib/db.ts`** — PostgreSQL `pg` client. Single `sql` tagged-template export used directly in route handlers. No ORM. Also exports DB entity types (`Store`, `Product`, `Invoice`, `InvoiceItem`, `ShoppingList`, `ShoppingListItem`, `Alert`, `UserPreference`).

**`lib/types.ts`** — Source of truth for Zod schemas. `ExtractedInvoiceSchema` defines the AI extraction contract. `DashboardStats` is the analytics API response shape.

**`lib/validations.ts`** — Zod schemas for API request validation: `SaveInvoiceSchema`, `CreateShoppingListSchema`, `AddListItemSchema`, `UpdateListItemSchema`, `UpdateAlertSchema`.

**`lib/invoice-utils.ts`** — Business logic extracted from route handlers:
- `normalizeProductName()` — lowercase, remove units/stop words, extract size, keep first 4 words
- `categorizeProduct()` — keyword-based categorization (Laticínios, Carnes, Bebidas, Limpeza, etc.)
- `extractUnit()` — extract measurement unit (ml, kg, g, etc.)
- `validateItemPrices()` — correct prices if unit_price × quantity ≠ total_price (tolerance: 5% or R$0.10)

**`lib/auth.ts`** — Better-auth v1 config (email/password + Google OAuth).

**`lib/auth-session.ts`** — `getSessionUserId()` extracts user ID from request headers. Used in all protected API routes.

**`lib/session-sql.ts`** — `setAppUserId()` sets PostgreSQL `app.user_id` per request for RLS strict mode.

**`lib/__tests__/`** — Unit tests for `validations.ts` and `invoice-utils.ts`.

### API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/extract-pdf` | POST | Sends PDF/image as base64 to Gemini, returns `ExtractedInvoice` |
| `/api/invoices` | GET, POST | List invoices (paginated); save invoice with store/product upsert + duplicate detection + price alerts |
| `/api/analytics` | GET | Dashboard stats: monthly spending, variation, inflation index, top price increases, spending by month |
| `/api/products` | GET | List products with search/category filter, purchase count, avg price, last purchase |
| `/api/products/[id]` | GET | Price history for a product (20 recent purchases with store/date/price) |
| `/api/shopping-lists` | GET, POST | List shopping lists; create new list |
| `/api/shopping-lists/[id]` | GET, POST, PATCH | List items; add item; update item status/quantity |
| `/api/alerts` | GET, PATCH | List price alerts; mark alerts as read |
| `/api/preferences` | GET, PATCH | Get/update user notification preferences and alert thresholds |
| `/api/data` | DELETE | Delete all user data (invoices, products, lists, alerts, preferences) |
| `/api/auth/[...all]` | * | Better-auth catch-all (OAuth/session management) |

### Components

| Component | Purpose |
|-----------|---------|
| `pdf-upload.tsx` | Core upload flow: file select/drop → extract → preview dialog → confirm. State machine: `idle \| uploading \| extracting \| preview \| saving \| success \| error` |
| `stats-cards.tsx` | Dashboard stat cards (spending, variation, total invoices, inflation) |
| `spending-chart.tsx` | Recharts area chart — spending by month |
| `price-alerts.tsx` | Alert list with icons/colors per alert type |
| `recent-invoices.tsx` | Recent invoices with store, date, amount |
| `mobile-nav.tsx` | Fixed bottom navigation bar (5 routes) |
| `error-state.tsx` | Error display with retry button |
| `theme-provider.tsx` | Dark/light theme provider |

### Database Schema (Postgres, no ORM)

```
stores               (id, name, cnpj, address, user_id, created_at)
products             (id, normalized_name, category, brand, unit, user_id, created_at)
invoices             (id, store_id, invoice_number, purchase_date, total_amount, pdf_filename, user_id, processed_at)
invoice_items        (id, invoice_id, product_id, raw_description, quantity, unit_price, total_price, user_id)
shopping_lists       (id, user_id, name, status: 'active'|'completed'|'archived', created_at)
shopping_list_items  (id, list_id, product_id, quantity, checked, estimated_price)
alerts               (id, product_id, user_id, alert_type, message, data: JSON, read, created_at)
user_preferences     (id, user_id, alert_threshold: default 15%, notify_price_increase, notify_opportunities, notify_restock_reminders, notify_weekly_summary, updated_at)
```

- **RLS enabled** with strict `app.user_id` isolation per request
- Product deduplication via `normalized_name` (lowercased, unit-stripped, first 4 words)
- Store deduplication by `name`
- Invoice duplicate detection by `invoice_number` or `(store_id, purchase_date, total_amount)`

### Authentication

**Better-auth v1** (`lib/auth.ts`)
- Email/password + Google OAuth
- Session via secure cookies
- `middleware.ts` redirects unauthenticated users to `/sign-in`
- Public routes: `/sign-in`, `/sign-up`, `/api/auth/*`

### App Routes (pages)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Stats, upload, spending chart, alerts, recent invoices |
| `/historico` | Price History | Product price tracking and trends |
| `/lista` | Shopping Lists | Create, manage, track shopping lists |
| `/alertas` | Alerts | Price increase alerts, opportunities, restock |
| `/config` | Settings | Alert thresholds, notification preferences, data export/delete |
| `/sign-in` | Sign In | Email + Google OAuth |
| `/sign-up` | Sign Up | Registration |

### Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (components in `components/ui/`)
- **AI SDK v6** (`ai` + `@ai-sdk/google`) with `generateText` + `Output.object()` for structured extraction
- **Google Gemini 2.5 Flash** for PDF/image extraction (vision multimodal)
- **Better-auth v1** for authentication (email/password + Google OAuth)
- **PostgreSQL** (`pg`) via pools and parameterized raw SQL
- **SWR v2** for client-side data fetching
- **Recharts** for spending charts
- **Zod** for runtime validation of AI output and API requests
- **Vitest** for unit tests + **Playwright** for E2E tests
- **Sonner** for toast notifications
- **date-fns** for date formatting

### Patterns to Follow

- All monetary values in BRL; use `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` for display
- AI extraction uses `Output.object({ schema: ExtractedInvoiceSchema })` — add new fields to the Zod schema in `lib/types.ts` first
- API request validation schemas live in `lib/validations.ts`
- Price alert threshold defaults to 15% (configurable per user in `user_preferences`)
- The app is Portuguese-language; keep all UI strings in pt-BR
- All protected API routes call `getSessionUserId(request)` then `setAppUserId(userId)` before queries
- Business logic for product normalization/categorization lives in `lib/invoice-utils.ts`, not inline in routes
