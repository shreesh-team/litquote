# README Template

> Copy the content below, replace any `<placeholder>` values, and save as the root `README.md` before submission.

---

```markdown
# litquote — Supplier Quote Comparison Tool

litquote is a procurement tool for manufacturing teams. A user creates an RFQ (Request for Quotation) for a specific item, collects supplier quotes, and compares them in a table that automatically highlights the best price. Quotes can be entered manually or imported from a CSV file.

---

## Features

- Create and manage RFQs with item name, specification, quantity, delivery date, and notes
- Add supplier quotes with unit price, currency, lead time, payment terms, and remarks
- Compare all quotes in a sortable table with computed total prices (Unit Price × Quantity)
- Automatic best-price highlighting — the lowest total is visually distinguished
- Currency warning when quotes use mixed currencies
- CSV import for bulk-adding supplier quotes, with row-level error reporting
- Sample CSV file included (`sample_quotes.csv`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | FastAPI (Python 3.13) + Uvicorn |
| Database | PostgreSQL 15+ |
| Client packages | npm |
| Server packages | uv |

---

## Prerequisites

- Node.js 20+
- Python 3.13+
- PostgreSQL 15+ (running locally)
- [uv](https://docs.astral.sh/uv/) — `pip install uv`

---

## Quick Start

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd litquote
cp server/.env.example server/.env
```

Edit `server/.env` and set `DATABASE_URL` to your local PostgreSQL connection string:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/litquote
```

### 2. Create the database and run migrations

```bash
createdb litquote
```

Migrations run automatically when the FastAPI server starts (step 3). No manual SQL execution required.

To load sample seed data for a quick demo, set `SEED_DB=true` in `server/.env` before starting the server.

### 3. Start the backend

```bash
cd server
uv run uvicorn main:app --reload --port 8000
```

The API is now available at `http://localhost:8000`.  
Interactive API docs (Swagger UI): `http://localhost:8000/docs`

### 4. Start the frontend

```bash
cd client
npm install
npm run dev
```

### 5. Open the app

Navigate to `http://localhost:5173` in your browser.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `APP_PORT` | `8000` | Uvicorn listen port |
| `SEED_DB` | `false` | Set to `true` to load sample data on first startup |

---

## API Documentation

FastAPI generates interactive Swagger UI documentation automatically.

`http://localhost:8000/docs`

All endpoints, request schemas, and response shapes are browsable and testable from this UI without any external tool.

---

## CSV Import

Supplier quotes can be bulk-imported from a CSV file on the RFQ detail page.

**Required columns:** `supplier_name`, `unit_price`

**Optional columns:** `currency` (default: `USD`), `lead_time_days`, `payment_terms`, `remarks`

Column headers are case-insensitive. Common aliases are accepted (e.g., `vendor` for `supplier_name`, `price` for `unit_price`).

A sample file is included in the repository root: **`sample_quotes.csv`**

---

## Design Decisions

- **UUID primary keys** — avoids sequential ID enumeration; PostgreSQL's `gen_random_uuid()` requires no external dependency
- **`NUMERIC(15,4)` for all money values** — floating-point arithmetic introduces rounding errors that compound across multiplication; `Decimal` is used end-to-end (DB → Python → JSON)
- **Total price is computed, not stored** — storing a derived value creates a consistency risk if RFQ quantity ever changes; computing it on read is trivially fast and always correct
- **`source` column on quotes** — distinguishes manual entries from CSV imports without a separate table; enables filtering and future audit trails at zero schema cost
- **Row-level CSV error reporting** — a CSV import that partially succeeds returns HTTP 200 with both imported quotes and a per-row error list; failing the entire request on any bad row would be unusable for large files
- **Raw SQL (no ORM)** — psycopg2 with hand-written queries keeps the data model explicit and readable for evaluators; the schema complexity does not warrant an ORM at this scope

---

## Out of Scope

Per the assignment brief, the following are intentionally not implemented:

- User authentication and sessions
- Deployment configuration
- Multi-user access control
- Advanced UI styling / animations
- OCR, PDF parsing, or Excel parsing
```
