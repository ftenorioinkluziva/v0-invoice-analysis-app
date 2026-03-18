# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start dev server at localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```

## Environment Variables

```bash
DATABASE_URL="postgresql://..."              # Neon Postgres (required)
GOOGLE_GENERATIVE_AI_API_KEY="..."          # Google AI — usado para extração de PDF (gemini-2.5-flash)
```

## Architecture

**NoteWise** is a mobile-first Brazilian invoice (nota fiscal) analysis app. Users upload PDF invoices, the AI extracts structured data, and the app tracks spending and price history.

### Data Flow

```
PDF upload → POST /api/extract-pdf (Claude claude-sonnet-4.6 via AI SDK)
           → structured ExtractedInvoice (validated with Zod)
           → user confirms preview dialog
           → POST /api/invoices (saves to Postgres)
           → price alert generation (>15% increase triggers alert)
```

### Key Layers

**`lib/db.ts`** — Neon serverless client. Single `sql` tagged-template export used directly in all route handlers. No ORM.

**`lib/types.ts`** — Source of truth for types. `ExtractedInvoiceSchema` (Zod) defines the AI extraction contract. `DashboardStats` is the analytics API response shape. DB entity types live in `lib/db.ts`.

**`app/api/`** — Route handlers (all Server Components):
- `extract-pdf/route.ts` — sends PDF as base64 to Claude, returns `ExtractedInvoice`
- `invoices/route.ts` — GET list + POST save; includes `normalizeProductName()`, `categorizeProduct()`, and `generatePriceAlerts()` inline
- `analytics/route.ts` — aggregates stats, personal inflation index, top price increases
- `alerts/route.ts`, `products/route.ts`, `shopping-lists/route.ts` — CRUD for their entities

**`app/page.tsx`** — Dashboard (client component). Uses SWR to fetch `/api/analytics` and `/api/invoices`, mutates both after successful upload.

**`components/pdf-upload.tsx`** — The core upload flow: file select/drop → extract → preview dialog → confirm save. State machine: `idle | uploading | extracting | preview | saving | success | error`.

**`app/layout.tsx`** — Single `MobileNav` + `Analytics` wrapper, max-w-lg centered, pb-20 for nav bar clearance.

### Database Schema (Postgres, no ORM)

```
stores         (id, name, cnpj, address)
products       (id, normalized_name, category, brand, unit)
invoices       (id, store_id, invoice_number, purchase_date, total_amount, pdf_filename)
invoice_items  (id, invoice_id, product_id, raw_description, quantity, unit_price, total_price)
shopping_lists (id, name, status)
shopping_list_items (id, list_id, product_id, quantity, checked, estimated_price)
alerts         (id, product_id, alert_type, message, data, read)
```

Product deduplication uses `normalized_name` (lowercased, unit-stripped, first 4 words). Stores are deduped by `name`.

### App Routes (pages)

- `/` — Dashboard: stats, upload, chart, alerts, recent invoices
- `/historico` — Price history per product
- `/lista` — Shopping lists
- `/alertas` — Price alerts
- `/config` — Settings

### Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (components in `components/ui/`)
- **AI SDK v6** (`ai` package) with `generateText` + `Output.object()` for structured extraction
- **Neon Postgres** (`@neondatabase/serverless`) via raw SQL tagged templates
- **SWR v2** for client-side data fetching
- **Recharts** for spending charts
- **Zod** for runtime validation of AI output

### Patterns to Follow

- All monetary values in BRL; use `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` for display
- AI extraction uses `Output.object({ schema: ExtractedInvoiceSchema })` — add new fields to the Zod schema in `lib/types.ts` first
- Price alert threshold is 15% increase (hardcoded in `generatePriceAlerts` in `invoices/route.ts`)
- The app is Portuguese-language; keep all UI strings in pt-BR
