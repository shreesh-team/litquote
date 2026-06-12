# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**litquote** — a fullstack supplier quote comparison tool. Procurement users create RFQs, collect supplier quotes, and compare them to identify the best (lowest total) price. CSV bulk-import of quotes is also supported.

Stack: React 19 + Vite 8 (client) / FastAPI + Python 3.13 (server) / PostgreSQL.

## Commands

### Backend (`cd server`)

```bash
uv run uvicorn main:app --reload --port 8000   # start dev server
uv run uvicorn main:app --port 8000            # start without reload
uv add <package>                               # add a dependency
```

No test runner is configured yet. FastAPI auto-generates Swagger UI at `http://localhost:8000/docs` for manual endpoint testing.

### Frontend (`cd client`)

```bash
npm run dev      # start Vite dev server on :5173
npm run build    # production build → dist/
npm run lint     # ESLint
npm run preview  # preview production build
```

### Database

```bash
createdb litquote
# Migrations run automatically at FastAPI startup via the lifespan context manager.
# To load seed data: set SEED_DB=true in server/.env before starting the server.
```

## Architecture

### Request Flow

All frontend API calls use `fetch('/api/...')`. Vite proxies `/api` to `http://localhost:8000` — configured in `client/vite.config.js`:

```js
server: { proxy: { '/api': 'http://localhost:8000' } }
```

This eliminates CORS in development. The CORS middleware in `main.py` covers non-proxied access (Postman, Swagger UI).

### Backend Structure

```
server/
  main.py                  # app factory, lifespan, CORS, exception handlers
  db/connection.py         # psycopg2 ThreadedConnectionPool, get_db dependency, run_migrations
  db/migrations/           # numbered .sql files — auto-applied at startup
  routers/rfq.py           # CRUD for RFQ ✓ implemented
  routers/quotes.py        # add/list/delete quotes ✓ implemented
  routers/csv_import.py    # POST /api/rfq/:id/quotes/import — file validation, dedup, bulk insert ✓ implemented
  models/rfq.py            # Pydantic request/response models ✓ implemented
  models/quote.py          # QuoteCreate / QuoteResponse / QuoteListResponse ✓ implemented
  services/__init__.py     # empty package marker ✓
  services/comparison.py   # enrich_quotes() — total_price + is_best_quote + delivery_risk ✓ implemented
  services/csv_parser.py   # CSV parsing, column aliasing, per-row validation, within-file dedup ✓ implemented
```

**No ORM** — raw SQL via psycopg2. All money values use `NUMERIC(15,4)` in PostgreSQL and `Decimal` in Python (never `float`).

> **`INSERT ... RETURNING` gotcha:** Table aliases (e.g. `r.column`) are not valid in RETURNING clauses — use bare column names only.

### Key Business Logic

- `total_price = unit_price × rfq.quantity` — computed in `services/comparison.py`, never stored
- `is_best_quote` — set to `True` for all quotes tied at the minimum `total_price` within an RFQ
- Quotes are sorted cheapest first; ties broken by `lead_time_days` ascending (no lead time sorts last)
- `delivery_risk` — `True` when `today + lead_time_days > rfq.delivery_expectation`; `False` if either field is null
- `currency_warning` — `True` when an RFQ's quotes have more than one distinct currency code; the comparison table shows a warning banner but still renders
- Quote `source` field — `"manual"` for form-entered quotes, `"csv"` for imported ones
- CSV dedup key — `(supplier_name, unit_price, currency)`; within-file duplicates are silently skipped (first wins); DB-level duplicates are rejected with a row-level error message
- RFQ status lifecycle: `open` → `awarded` (via `/award`) → `void` (via `/void`); `open` → `void` also allowed; `void` is terminal
- Status changes only via `/award` and `/void` endpoints; `PUT /api/rfq/:id` has **no** status field
- Lock rule: `awarded` and `void` RFQs reject all quote mutations (add/edit/delete/CSV import) with 409; RFQ fields also non-editable
- `is_awarded` — `True` for the single quote matching `rfq.awarded_quote_id`
- psycopg2 UUID gotcha: columns returned as plain strings; FastAPI path params are `UUID` objects — always compare with `str()`
- StopIteration gotcha: `next(genexpr)` raises `StopIteration` → `RuntimeError` in anyio threadpool; always use `next((genexpr), None)`

### Frontend Structure

```
client/src/
  api/client.js              # Axios instance, baseURL: '/api'
  components/
    Layout.jsx / Layout.css        # persistent shell — left sidebar nav (200px) + right <Outlet />
    CreateRFQModal.jsx/.css        # modal overlay for RFQ creation (no dedicated /rfq/new page)
    RFQSummaryCard.jsx             # compact horizontal metadata strip — columns (label/value), no toggle ✓
    QuoteTable.jsx / QuoteTable.css  # paginated comparison table, 10 rows/page, best/awarded highlights, lock-aware ✓
    AddQuoteForm.jsx / AddQuoteForm.css  # quote input form; accepts initialValues prop for edit pre-population ✓
    AddQuoteModal.jsx              # modal wrapper for AddQuoteForm ✓
    EditRFQModal.jsx               # pre-populated RFQ edit form (open RFQs only; no status field) ✓
    EditQuoteModal.jsx             # wraps AddQuoteForm with initialValues for quote editing ✓
    CSVImportModal.jsx             # modal for CSV bulk import — file picker, result banner, error table ✓
    ConfirmModal.jsx               # reusable confirm dialog; replaces all window.confirm usage ✓
  hooks/
    useRFQList.js            # GET /api/rfq?search=, deleteRFQ, pagination ✓
    useCreateRFQ.js          # POST /api/rfq, 422 field-error mapping, navigate on success ✓
    useRFQ.js                # GET /api/rfq/:id; exposes setRFQ for local state updates ✓
    useEditRFQ.js            # PUT /api/rfq/:id ✓
    useQuotes.js             # GET /api/rfq/:id/quotes, deleteQuote ✓
    useAddQuote.js           # POST /api/rfq/:id/quotes, 422 field-error mapping ✓
    useEditQuote.js          # PUT /api/quote/:id ✓
    useAwardQuote.js         # POST /api/rfq/:id/award ✓
    useVoidRFQ.js            # POST /api/rfq/:id/void ✓
    useCSVImport.js          # POST /api/rfq/:id/quotes/import ✓
  pages/
    RFQListPage.jsx          # /rfq — search bar, status badges, table, ConfirmModal for delete ✓
    RFQDetailPage.jsx        # /rfq/:id — metadata strip, InsightBanner, Edit/Void buttons, quote table ✓
```

Routes: `/` → redirect `/rfq` → `RFQListPage`, `/rfq/:id` → `RFQDetailPage`. Create RFQ is a modal on the list page, not a separate route. State is managed with `useState` + custom hooks per page. No global state library.

**Layout notes:**
- `.content` is `height: 100svh; overflow-y: auto` — it is the scroll container; sticky pagination relies on this
- `.page` is `flex: 1; display: flex; flex-direction: column` with no `max-width` — fills the right panel
- `.pagination` uses `position: sticky; bottom: 0; justify-content: center`
- `#root` boilerplate `flex-direction: column` is overridden to `row` in `index.css`
- `.section-header` — flex row used when a section heading needs a right-aligned action button(s)
- `.rfq-meta-strip` — horizontal flex container for the RFQ metadata strip; no overflow hidden (would clip tooltips)
- `.rfq-meta-item` — column layout (label/value); `position: relative` for tooltip anchor; `flex: 1` on spec/notes items
- `.rfq-meta-value--truncate[data-tooltip]::after` — CSS tooltip, fixed 280px, appears below on hover
- `AddQuoteModal.jsx`, `EditRFQModal.jsx`, `EditQuoteModal.jsx`, and `CSVImportModal.jsx` all import `CreateRFQModal.css` (shared modal chrome)
- `RFQDetailPage` section header shows "↑ Upload CSV" and "+ Add Quote" only when `rfq.status === 'open'`

### Environment

Copy `server/.env` (already exists with a PostgreSQL template) — the key variable is `DATABASE_URL`. Set `SEED_DB=true` to auto-load one sample RFQ with three quotes on first startup.

## Documentation

Detailed specs live in two places:

- `product-docs/` — architecture, data model (DDL), full API spec, CSV format, frontend guide, backend implementation guide, README template
- `.claude/specs/` — feature-level specs with user stories and acceptance criteria for each of the four features (RFQ management, quote management, quote comparison, CSV import)
