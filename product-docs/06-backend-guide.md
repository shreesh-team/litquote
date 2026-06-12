# Backend Implementation Guide

## Project Structure

```
server/
├── main.py                        # app factory, lifespan, CORS, exception handlers
├── pyproject.toml
├── .env / .env.example
├── db/
│   ├── connection.py              # ThreadedConnectionPool, get_db, run_migrations
│   └── migrations/
│       ├── 001_initial_schema.sql # rfq + supplier_quote tables
│       ├── 002_rfq_workflow.sql   # adds status + awarded_quote_id columns
│       └── 003_void_status.sql    # replaces 'cancelled' constraint with 'void'
├── routers/
│   ├── rfq.py                     # CRUD + /award + /void endpoints
│   ├── quotes.py                  # add/list/edit/delete/award quotes
│   └── csv_import.py              # POST /api/rfq/:id/quotes/import
├── models/
│   ├── rfq.py                     # RFQCreate, RFQUpdate, RFQResponse, RFQListResponse
│   └── quote.py                   # QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse
└── services/
    ├── __init__.py
    ├── comparison.py              # enrich_quotes()
    └── csv_parser.py              # parse(), per-row validation, dedup
```

---

## Application Startup (`main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.connection import create_pool, close_pool, run_migrations
from routers import rfq, quotes, csv_import

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = create_pool()
    run_migrations(app.state.db_pool)
    yield
    close_pool(app.state.db_pool)

app = FastAPI(title="litquote API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[...], allow_methods=["*"], allow_headers=["*"])
app.include_router(rfq.router)     # prefix="/api/rfq"
app.include_router(quotes.router)  # no prefix — mounts /api/rfq/:id/quotes and /api/quote/:id
app.include_router(csv_import.router)
```

---

## Database Migrations

Migrations run automatically at startup via `run_migrations()`. Files are applied in filename order; applied versions tracked in `schema_migrations` table.

### `001_initial_schema.sql`

Creates `rfq` and `supplier_quote` tables.

### `002_rfq_workflow.sql`

```sql
ALTER TABLE rfq
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'awarded', 'cancelled')),
  ADD COLUMN awarded_quote_id UUID REFERENCES supplier_quote(id) ON DELETE SET NULL;
```

### `003_void_status.sql`

Drops the old `CHECK` constraint (which included `'cancelled'`) and replaces it:

```sql
-- drops old constraint dynamically (name varies by install)
UPDATE rfq SET status = 'void' WHERE status = 'cancelled';
ALTER TABLE rfq ADD CONSTRAINT rfq_status_check
    CHECK (status IN ('open', 'awarded', 'void'));
```

Valid statuses after migration: `open`, `awarded`, `void`.

---

## Pydantic Models

### `models/rfq.py`

```python
class RFQCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=255)
    material_spec: str | None = None
    quantity: Decimal = Field(..., gt=0)
    delivery_expectation: date | None = None
    notes: str | None = None

class RFQUpdate(BaseModel):
    # All fields optional; NO status field — status via /award and /void only
    item_name: str | None = Field(default=None, min_length=1, max_length=255)
    material_spec: str | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    delivery_expectation: date | None = None
    notes: str | None = None

class RFQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    item_name: str
    material_spec: str | None
    quantity: Decimal
    delivery_expectation: date | None
    notes: str | None
    status: str                    # 'open' | 'awarded' | 'void'
    awarded_quote_id: UUID | None
    created_at: datetime
    updated_at: datetime
    quote_count: int
```

### `models/quote.py`

```python
class QuoteCreate(BaseModel):
    supplier_name: str = Field(..., min_length=1, max_length=255)
    unit_price: Decimal = Field(..., ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    lead_time_days: int | None = Field(default=None, ge=0)
    payment_terms: str | None = Field(default=None, max_length=255)
    remarks: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, v): return v.upper()

class QuoteUpdate(BaseModel):
    # All fields optional — same validators as QuoteCreate
    supplier_name: str | None = ...
    unit_price: Decimal | None = ...
    currency: str | None = ...
    lead_time_days: int | None = ...
    payment_terms: str | None = ...
    remarks: str | None = ...

class QuoteResponse(BaseModel):
    id: UUID
    rfq_id: UUID
    supplier_name: str
    unit_price: Decimal
    currency: str
    lead_time_days: int | None
    payment_terms: str | None
    remarks: str | None
    source: str
    total_price: Decimal           # computed
    is_best_quote: bool            # computed
    is_awarded: bool               # computed
    delivery_risk: bool            # computed
    created_at: datetime
```

---

## Service: `services/comparison.py`

```python
def enrich_quotes(
    quotes: list[dict],
    rfq_quantity: Decimal,
    delivery_expectation: date | None = None,
    awarded_quote_id: str | None = None,
) -> tuple[list[dict], str | None]:
```

Steps:
1. `total_price = unit_price × rfq_quantity` for each quote
2. Find `min_total`; set `is_best_quote = total_price == min_total`
3. `is_awarded = str(q["id"]) == str(awarded_quote_id)` when `awarded_quote_id` is set
4. `delivery_risk = date.today() + timedelta(days=lead_time_days) > delivery_expectation` — `False` if either is null
5. Sort by `total_price` ASC, then `lead_time_days` ASC (null last)
6. Return `(enriched, best_quote_id)`

**Key gotchas:**
- psycopg2 without `register_uuid()` returns UUID columns as **plain strings**. FastAPI path params are Python `UUID` objects. Always compare with `str(q["id"]) == str(quote_id)`.
- `next(genexpr)` raises `StopIteration` which becomes `RuntimeError` in FastAPI's anyio threadpool. Always use `next((genexpr), None)` with an explicit None check.

---

## Routers

### `routers/rfq.py`

Endpoints: `POST /`, `GET /`, `GET /{rfq_id}`, `PUT /{rfq_id}`, `POST /{rfq_id}/award` (delegates to quotes router), `POST /{rfq_id}/void`, `DELETE /{rfq_id}`.

`PUT /{rfq_id}` checks `status == 'open'` before applying updates (409 otherwise). Uses `model_dump(exclude_unset=True)` for partial updates with a dynamic `SET` clause.

`POST /{rfq_id}/void` transitions any status to `void` unconditionally (no source-state check needed; `void` is terminal and idempotent in practice).

### `routers/quotes.py`

Key helper:

```python
def _check_rfq_mutable(rfq: dict) -> None:
    if rfq["status"] == "awarded":
        raise HTTPException(409, "This RFQ has been awarded and is locked.")
    if rfq["status"] == "void":
        raise HTTPException(409, "This RFQ has been voided and cannot be modified.")
```

Called at the top of: `add_quote`, `update_quote`, `delete_quote`.

`award_rfq` (`POST /{rfq_id}/award`): verifies quote belongs to RFQ, sets `status='awarded'` and `awarded_quote_id`.

### `routers/csv_import.py`

Imports `_check_rfq_mutable` from `routers.quotes` and calls it before processing the file.

---

## Running the Server

```bash
cd server
uv run uvicorn main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

Set `SEED_DB=true` in `server/.env` before first startup to load one sample RFQ with three quotes.
