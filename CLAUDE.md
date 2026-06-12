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

All frontend API calls use `fetch('/api/...')`. Vite proxies `/api` to `http://localhost:8000` — add the proxy to `client/vite.config.js` (not yet configured in the scaffold):

```js
server: { proxy: { '/api': 'http://localhost:8000' } }
```

This eliminates CORS in development. The CORS middleware already in `main.py` covers non-proxied access (Postman, Swagger UI).

### Backend Structure (planned, per product-docs)

```
server/
  main.py                  # app factory, lifespan, CORS, exception handlers
  db/connection.py         # psycopg2 ThreadedConnectionPool, get_db dependency, run_migrations
  db/migrations/           # numbered .sql files — auto-applied at startup
  routers/rfq.py           # CRUD for RFQ
  routers/quotes.py        # add/list/delete quotes
  routers/csv_import.py    # multipart CSV upload
  models/rfq.py            # Pydantic request/response models
  models/quote.py
  services/comparison.py   # total_price + is_best_quote computation (pure function, no DB)
  services/csv_parser.py   # CSV parsing + per-row validation
```

**No ORM** — raw SQL via psycopg2. All money values use `NUMERIC(15,4)` in PostgreSQL and `Decimal` in Python (never `float`).

### Key Business Logic

- `total_price = unit_price × rfq.quantity` — computed in `services/comparison.py`, never stored
- `is_best_quote` — set to `True` for all quotes tied at the minimum `total_price` within an RFQ
- `currency_warning` — `True` when an RFQ's quotes have more than one distinct currency code; the comparison table shows a warning banner but still renders
- Quote `source` field — `"manual"` for form-entered quotes, `"csv"` for imported ones

### Frontend Structure (planned, per product-docs)

Three pages under React Router: `/rfq` (list), `/rfq/new` (create), `/rfq/:id` (detail + comparison table + add-quote form + CSV import). State is managed with `useState` + custom hooks per page (`useRFQList`, `useRFQ`, `useAddQuote`, `useCSVImport`). No global state library.

### Environment

Copy `server/.env` (already exists with a PostgreSQL template) — the key variable is `DATABASE_URL`. Set `SEED_DB=true` to auto-load one sample RFQ with three quotes on first startup.

## Documentation

Detailed specs live in two places:

- `product-docs/` — architecture, data model (DDL), full API spec, CSV format, frontend guide, backend implementation guide, README template
- `.claude/specs/` — feature-level specs with user stories and acceptance criteria for each of the four features (RFQ management, quote management, quote comparison, CSV import)
