# litquote

A full-stack supplier quote comparison tool for procurement teams. Create RFQs, collect supplier quotes manually or via CSV, and identify the best deal at a glance.

---

## Features

- **RFQ management** — create, edit, search, and paginate RFQs
- **Quote collection** — add quotes manually or bulk-import from CSV
- **Quote comparison** — sortable table with best-quote highlight, delivery risk flags, and currency mismatch warnings
- **RFQ lifecycle** — open → awarded → void; awarded and voided RFQs are locked against edits
- **CSV import** — flexible column aliases, per-row validation, structured error table, append or replace mode
- **Insight banner** — shows best supplier, total saving vs. next best, and on-time delivery status

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | FastAPI + Python 3.13 |
| Database | PostgreSQL |
| DB access | psycopg2 (raw SQL, no ORM) |

---

## Prerequisites

- Python 3.13
- Node.js 18+
- PostgreSQL 14+
- [uv](https://github.com/astral-sh/uv) (Python package manager)

---

## Setup

### 1. Database

```bash
createdb litquote
```

Migrations run automatically when the backend starts. No manual steps needed.

To seed the database with one sample RFQ and three quotes, set `SEED_DB=true` in `server/.env` before the first startup.

### 2. Backend

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL
uv run uvicorn main:app --reload --port 8000
```

**`server/.env`**

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/litquote
SEED_DB=false                  # set true to load seed data on first run
```

Swagger UI is available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd client
npm install
npm run dev                    # starts on http://localhost:5173
```

Vite proxies all `/api` requests to `http://localhost:8000`, so no CORS configuration is needed in development.

---

## CSV Import

The import endpoint accepts a CSV file with the following columns.

| Column | Required | Notes |
|---|---|---|
| `supplier_name` | Yes | Also accepted: `supplier`, `vendor`, `vendor_name`, `company` |
| `unit_price` | Yes | Also accepted: `price`, `unit_cost`, `cost` |
| `currency` | No | Defaults to `USD`. Also accepted: `currency_code`, `curr` |
| `lead_time_days` | No | Also accepted: `lead_time`, `lead_days`, `days` |
| `payment_terms` | No | Also accepted: `terms`, `payment` |
| `remarks` | No | Also accepted: `notes`, `comment`, `comments` |

A sample file is included at [`sample_quotes.csv`](./sample_quotes.csv).

**Import modes**

- **Append** (default) — adds new quotes; rows that already exist for the RFQ are reported as errors
- **Replace** — deletes all existing quotes for the RFQ and inserts the valid rows from the file

**Validation**

- File must be under 5 MB
- `supplier_name` and `unit_price` are required; any row missing them is rejected with a specific error message
- `unit_price` must be a non-negative decimal
- `currency` must be a 3-letter ISO code if provided
- `lead_time_days` must be a non-negative integer if provided
- Duplicate rows within the file (same supplier + price + currency) are silently deduplicated; the first occurrence wins
- Valid rows are always inserted even if some rows in the same file fail

---

## Project Structure

```
litquote/
├── client/                  # React frontend
│   └── src/
│       ├── api/             # Axios instance
│       ├── components/      # Reusable UI components
│       ├── hooks/           # Custom hooks (one per API concern)
│       └── pages/           # RFQListPage, RFQDetailPage
└── server/                  # FastAPI backend
    ├── db/
    │   ├── connection.py    # Connection pool, migration runner
    │   └── migrations/      # Numbered .sql files, auto-applied at startup
    ├── models/              # Pydantic request/response models
    ├── routers/             # rfq.py, quotes.py, csv_import.py
    └── services/
        ├── comparison.py    # Quote enrichment logic (total price, best quote, delivery risk)
        └── csv_parser.py    # CSV parsing and per-row validation
```

---

## Design Decisions and Tradeoffs

### No ORM
Raw SQL via psycopg2. For an app of this scope it keeps queries explicit and easy to read. The tradeoff is more manual row-to-dict mapping, but there are no complex joins that would benefit from ORM abstractions.

### Money as NUMERIC, never float
All prices use `NUMERIC(15,4)` in PostgreSQL and `Decimal` in Python throughout. Floating-point arithmetic is not used anywhere in the financial calculations.

### Total price is computed, not stored
`total_price = unit_price × quantity` is calculated in `services/comparison.py` on every read. This avoids stale data if the RFQ quantity is later edited.

### Deduplication in application code
The dedup key `(supplier_name, unit_price, currency)` is enforced in the import router rather than as a DB unique constraint. This allows the same supplier to appear at different prices across separate manual quotes while still catching accidental CSV duplicates. The tradeoff is that concurrent imports could theoretically bypass it.

### RFQ status lifecycle
`open → awarded` and `open → void` are the only forward transitions; `awarded → void` is also allowed (to reject a decision). `void` is terminal. Status changes only via dedicated `/award` and `/void` endpoints — the general-purpose `PUT /api/rfq/:id` intentionally has no `status` field, preventing accidental state transitions through normal edits.

### Frontend state
`useState` + custom hooks per page. No global state library. Each hook owns one slice of API state (loading, error, data) and exposes named actions. This keeps pages readable and avoids the overhead of Redux/Zustand for an app with two routes.

### Migration system
Migrations are plain numbered `.sql` files applied automatically at startup via a `schema_migrations` tracking table. No migration library dependency — the runner is ~30 lines in `db/connection.py`.

---

## API Reference

Full API documentation is available via Swagger UI at `http://localhost:8000/docs` when the backend is running.

Key endpoints:

```
GET     /api/rfq                          List RFQs (search, pagination)
POST    /api/rfq                          Create RFQ
GET     /api/rfq/:id                      Get RFQ
PUT     /api/rfq/:id                      Update RFQ fields (open only)
DELETE  /api/rfq/:id                      Delete RFQ (open only)
POST    /api/rfq/:id/award                Award a quote
POST    /api/rfq/:id/void                 Void an RFQ

GET     /api/rfq/:id/quotes               List quotes (enriched)
POST    /api/rfq/:id/quotes               Add quote
PUT     /api/quote/:id                    Edit quote
DELETE  /api/quote/:id                    Delete quote
POST    /api/rfq/:id/quotes/import        CSV import (multipart, mode=append|replace)
```
