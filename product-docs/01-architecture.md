# System Architecture

## Overview

litquote is a procurement tool that lets users create RFQs (Requests for Quotation), collect supplier quotes, and compare them to identify the best price. The system is a standard three-tier web application with a React frontend, FastAPI backend, and PostgreSQL database.

## System Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│              http://localhost:5173                      │
└──────────────────────────┬──────────────────────────────┘
                           │  fetch('/api/...')
                           │  (Vite proxy rewrites to :8000)
┌──────────────────────────▼──────────────────────────────┐
│               Vite Dev Server (:5173)                   │
│             React 19 SPA (client/)                      │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP/JSON
┌──────────────────────────▼──────────────────────────────┐
│               FastAPI + Uvicorn (:8000)                 │
│             Python 3.13 (server/)                       │
│  Routers → Services → psycopg2 connection pool          │
└──────────────────────────┬──────────────────────────────┘
                           │  SQL (psycopg2)
┌──────────────────────────▼──────────────────────────────┐
│              PostgreSQL (:5432)                         │
│              database: litquote                         │
└─────────────────────────────────────────────────────────┘
```

In development the Vite proxy transparently forwards all `/api/*` requests to FastAPI, so the React app never hits a CORS boundary.

---

## Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 19 + Vite 8 | Already scaffolded; functional components only |
| Backend | FastAPI | Auto-generates OpenAPI docs at `/docs` — evaluators can explore the API without a client |
| DB driver | psycopg2 (raw SQL) | Deliberately no ORM — raw SQL directly demonstrates data modeling competence, a key evaluation criterion |
| Validation | Pydantic v2 | Already in pyproject.toml; generates structured 422 responses automatically |
| Money types | `NUMERIC(15,4)` / Python `Decimal` | Float arithmetic is wrong for currency; this is non-negotiable |
| IDs | UUID v4 | Avoids sequential ID enumeration; `gen_random_uuid()` is built into PostgreSQL 13+ |
| State management | `useState` + custom hooks | Redux/Zustand is overkill for this scope; keeps the code readable for evaluators |

---

## Target Repository Layout

```
litquote/
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js          # axios instance, baseURL: '/api'
│       ├── components/            # reusable UI primitives
│       │   ├── Badge.jsx
│       │   └── ErrorMessage.jsx
│       ├── features/
│       │   ├── rfq/
│       │   │   ├── RFQForm.jsx
│       │   │   ├── RFQTable.jsx
│       │   │   └── RFQSummaryCard.jsx
│       │   └── quotes/
│       │       ├── QuoteComparisonTable.jsx
│       │       ├── AddQuoteForm.jsx
│       │       └── CSVImportSection.jsx
│       ├── hooks/
│       │   ├── useRFQList.js
│       │   ├── useRFQ.js
│       │   ├── useCreateRFQ.js
│       │   ├── useAddQuote.js
│       │   └── useCSVImport.js
│       └── pages/
│           ├── RFQListPage.jsx
│           ├── CreateRFQPage.jsx
│           └── RFQDetailPage.jsx
├── server/
│   ├── main.py                    # app factory, lifespan, middleware
│   ├── pyproject.toml
│   ├── .env
│   ├── .env.example
│   ├── db/
│   │   ├── connection.py          # pool init, get_db dependency, run_migrations
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       └── 002_seed_data.sql
│   ├── routers/
│   │   ├── rfq.py
│   │   ├── quotes.py
│   │   └── csv_import.py
│   ├── models/
│   │   ├── rfq.py                 # Pydantic request/response models
│   │   └── quote.py
│   └── services/
│       ├── comparison.py          # total_price + best-quote logic
│       └── csv_parser.py          # CSV parsing + row validation
├── product-docs/
│   └── *.md
├── sample_quotes.csv
└── README.md
```

---

## Environment Configuration

### `server/.env.example`

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/litquote
CORS_ORIGIN=http://localhost:5173
APP_PORT=8000
SEED_DB=false
```

`SEED_DB=true` triggers `002_seed_data.sql` at startup — one RFQ with three supplier quotes ready for demo use.

### Vite Proxy (`client/vite.config.js`)

```js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

All `fetch('/api/rfq')` calls in React route through to FastAPI without any CORS configuration needed during development. The existing CORS middleware in `main.py` is still required for any non-proxied access (e.g., Postman, the OpenAPI docs UI).

---

## Data Flows

### Create RFQ
1. User fills the RFQ form and submits
2. React calls `POST /api/rfq` with JSON body
3. FastAPI validates via Pydantic (`RFQCreate`); returns 422 with field errors if invalid
4. On valid input: `INSERT INTO rfq` returning full row
5. Response 201 with `RFQResponse` (includes `quote_count: 0`)
6. React navigates to `/rfq/{id}` (the detail/comparison page)

### Add Supplier Quote
1. User fills the add-quote form on the detail page
2. React calls `POST /api/rfq/{id}/quotes`
3. FastAPI verifies the RFQ exists (404 if not)
4. Inserts quote, then calls `comparison.enrich_quotes_with_comparison` to compute `total_price` and `is_best_quote`
5. Response 201 with the enriched quote
6. React re-fetches the full quote list to update the comparison table

### Compare Quotes
1. React calls `GET /api/rfq/{id}/quotes` when the detail page loads
2. FastAPI returns `{ rfq, quotes[], best_quote_id, summary }` — quotes already sorted by `total_price` ASC
3. React renders the comparison table, applying the best-quote highlight to the row matching `best_quote_id`
4. A `currency_warning` banner renders if `summary.currency_warning === true`

### CSV Import
1. User selects a `.csv` file and clicks "Import CSV"
2. React posts as `multipart/form-data` to `POST /api/rfq/{id}/quotes/import`
3. FastAPI reads the file, validates size (≤ 5 MB), calls `csv_parser.parse_csv`
4. Parser returns `(valid_rows, error_rows)` — partial success is expected and valid
5. FastAPI bulk-inserts valid rows via `executemany`; response is always HTTP 200 with `{ imported, failed, errors[] }`
6. React displays the summary banner and error table; newly imported quotes appear in the comparison table

---

## Error Handling Strategy

| Scenario | HTTP Status | Response Shape |
|---|---|---|
| Invalid request body | 422 | `{ detail: [{ loc, msg, type }] }` (Pydantic default) |
| Resource not found | 404 | `{ detail: "RFQ not found" }` |
| CSV file not parseable | 400 | `{ detail: "File is not valid CSV" }` |
| CSV file too large | 400 | `{ detail: "File exceeds 5 MB limit" }` |
| CSV row-level errors | 200 | `{ imported, failed, errors: [{ row, column, value, message }] }` |
| Unhandled server error | 500 | `{ detail: "Internal server error" }` (full traceback logged server-side) |

The CSV import endpoint deliberately returns 200 even when some rows fail. Returning 4xx for partial failures would make it impossible for the client to surface which rows succeeded and which failed.

All errors on the frontend are displayed inline near the triggering UI element — never swallowed silently with just a `console.log`.
