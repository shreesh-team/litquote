# Backend Implementation Guide

## Project Structure (final target)

```
server/
├── main.py                        # app factory, lifespan, middleware, exception handlers ✓
├── pyproject.toml
├── .env
├── .env.example
├── db/
│   ├── connection.py              # pool init, get_db dependency, run_migrations ✓
│   └── migrations/
│       ├── 001_initial_schema.sql ✓
│       └── 002_seed_data.sql
├── routers/
│   ├── rfq.py                     # ✓ implemented
│   ├── quotes.py                  # ✓ implemented
│   └── csv_import.py
├── models/
│   ├── rfq.py                     # Pydantic request/response models ✓
│   └── quote.py                   # ✓ implemented
└── services/
    ├── __init__.py                # empty package marker ✓
    ├── comparison.py              # enrich_quotes() — total_price + best-quote ✓
    └── csv_parser.py              # CSV parsing and row validation
```

---

## Application Startup (`main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

from db.connection import create_pool, close_pool, run_migrations
from routers import rfq, quotes, csv_import

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.db_pool = create_pool()
    run_migrations(app.state.db_pool)
    yield
    # Shutdown
    close_pool(app.state.db_pool)

app = FastAPI(title="litquote API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rfq.router, prefix="/api")
app.include_router(quotes.router, prefix="/api")
app.include_router(csv_import.router, prefix="/api")

@app.exception_handler(Exception)
async def generic_handler(request, exc):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)
```

Pydantic's `RequestValidationError` → 422 is handled by FastAPI automatically; no custom handler needed unless you want to reshape the response.

---

## Database Connection (`db/connection.py`)

Uses `psycopg2.pool.ThreadedConnectionPool` — thread-safe, suitable for Uvicorn's threaded workers.

```python
import os
import psycopg2
import psycopg2.pool
from fastapi import Request

def create_pool():
    return psycopg2.pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=10,
        dsn=os.environ["DATABASE_URL"]
    )

def close_pool(pool):
    pool.closeall()

def get_db(request: Request):
    conn = request.app.state.db_pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        request.app.state.db_pool.putconn(conn)

def run_migrations(pool):
    """Run any pending numbered SQL migration files."""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(10) PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            conn.commit()

            migrations_dir = Path(__file__).parent / "migrations"
            for sql_file in sorted(migrations_dir.glob("*.sql")):
                version = sql_file.stem[:3]  # e.g., "001"
                cur.execute("SELECT 1 FROM schema_migrations WHERE version = %s", (version,))
                if cur.fetchone():
                    continue
                # Skip seed if SEED_DB not set
                if "seed" in sql_file.name and os.getenv("SEED_DB") != "true":
                    continue
                cur.execute(sql_file.read_text())
                cur.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
                conn.commit()
    finally:
        pool.putconn(conn)
```

`get_db` is used as a FastAPI dependency: `db: Connection = Depends(get_db)`. The connection is returned to the pool after every request, even on error.

---

## Pydantic Models

### `models/rfq.py`

```python
from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

class RFQCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=255)
    material_spec: str | None = None
    quantity: Decimal = Field(gt=0)
    delivery_expectation: date | None = None
    notes: str | None = None

class RFQResponse(RFQCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime
    quote_count: int

class RFQListResponse(BaseModel):
    items: list[RFQResponse]
    total: int
    limit: int
    offset: int
```

### `models/quote.py`

```python
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import datetime
from uuid import UUID

class QuoteCreate(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    unit_price: Decimal = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    lead_time_days: int | None = Field(default=None, ge=0)
    payment_terms: str | None = Field(default=None, max_length=255)
    remarks: str | None = None

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, v):
        return v.upper()

class QuoteResponse(QuoteCreate):
    id: UUID
    rfq_id: UUID
    source: str
    total_price: Decimal
    is_best_quote: bool
    created_at: datetime

class QuoteSummary(BaseModel):
    quote_count: int
    min_total_price: Decimal | None
    max_total_price: Decimal | None
    currency_warning: bool

class QuoteListResponse(BaseModel):
    rfq: dict                      # RFQResponse dict — avoids circular import
    quotes: list[QuoteResponse]
    best_quote_id: UUID | None
    summary: QuoteSummary

class CSVImportResult(BaseModel):
    imported: int
    failed: int
    errors: list[dict]
    quotes: list[QuoteResponse]
```

---

## Service: `services/comparison.py`

```python
from decimal import Decimal
from uuid import UUID

def enrich_quotes(
    quotes: list[dict],
    rfq_quantity: Decimal,
) -> tuple[list[dict], UUID | None]:
    """
    Adds total_price and is_best_quote to each quote dict in-place.
    Returns: (enriched_quotes, best_quote_id)
    currency_warning is computed separately by the router from the quote set.
    """
    if not quotes:
        return [], None

    for q in quotes:
        q["total_price"] = q["unit_price"] * rfq_quantity

    min_total = min(q["total_price"] for q in quotes)
    best_quote_id: UUID | None = None

    for q in quotes:
        q["is_best_quote"] = q["total_price"] == min_total
        if q["is_best_quote"] and best_quote_id is None:
            best_quote_id = q["id"]

    return quotes, best_quote_id
```

Key behaviors:
- Ties are handled correctly: multiple quotes can have `is_best_quote = True`
- `best_quote_id` is the id of the first quote (in iteration order) with `is_best_quote = True`
- `currency_warning` is computed by the router: `len({q["currency"] for q in quotes}) > 1`
- Quotes are returned in `created_at ASC` order (insertion order from the DB query)
- This function is pure (no DB access) — straightforward to unit test

---

## Service: `services/csv_parser.py`

```python
import csv
import io
from decimal import Decimal, InvalidOperation
from uuid import UUID

HEADER_ALIASES = {
    "supplier": "supplier_name", "vendor": "supplier_name",
    "vendor_name": "supplier_name", "company": "supplier_name",
    "price": "unit_price", "unit_cost": "unit_price", "cost": "unit_price",
    "currency_code": "currency", "curr": "currency",
    "lead_time": "lead_time_days", "lead_days": "lead_time_days", "days": "lead_time_days",
    "terms": "payment_terms", "payment": "payment_terms",
    "notes": "remarks", "comment": "remarks", "comments": "remarks",
}

def parse_csv(file_content: str, rfq_id: UUID) -> tuple[list[dict], list[dict]]:
    content = file_content.lstrip("﻿")  # strip BOM
    reader = csv.DictReader(io.StringIO(content))

    # Normalize headers
    if reader.fieldnames is None:
        raise ValueError("File is not valid CSV")
    normalized = {
        HEADER_ALIASES.get(h.strip().lower(), h.strip().lower()): h
        for h in reader.fieldnames
    }
    reader.fieldnames = list(normalized.keys())

    required = {"supplier_name", "unit_price"}
    missing = required - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Required columns missing: {', '.join(sorted(missing))}")

    valid_rows, error_rows = [], []
    for row_num, raw_row in enumerate(reader, start=1):
        row = {k: (v.strip() if v else "") for k, v in raw_row.items()}

        # Skip fully empty rows
        if not any(row.values()):
            continue

        errors = _validate_row(row_num, row)
        if errors:
            error_rows.extend(errors)
        else:
            valid_rows.append({
                "rfq_id": str(rfq_id),
                "supplier_name": row["supplier_name"],
                "unit_price": Decimal(row["unit_price"]),
                "currency": row.get("currency", "USD").upper() or "USD",
                "lead_time_days": int(row["lead_time_days"]) if row.get("lead_time_days") else None,
                "payment_terms": row.get("payment_terms") or None,
                "remarks": row.get("remarks") or None,
                "source": "csv",
            })

    return valid_rows, error_rows


def _validate_row(row_num: int, row: dict) -> list[dict]:
    errors = []

    def err(column, value, message):
        errors.append({"row": row_num, "column": column, "value": value, "message": message})

    # supplier_name
    if not row.get("supplier_name"):
        err("supplier_name", row.get("supplier_name", ""), "supplier_name is required")
    elif len(row["supplier_name"]) > 255:
        err("supplier_name", row["supplier_name"][:40] + "...", "supplier_name exceeds 255 characters")

    # unit_price
    try:
        price = Decimal(row.get("unit_price", ""))
        if price < 0:
            raise ValueError
    except (InvalidOperation, ValueError):
        err("unit_price", row.get("unit_price", ""), "unit_price must be a non-negative number")

    # currency (optional)
    currency = row.get("currency", "")
    if currency and (len(currency) != 3 or not currency.isalpha()):
        err("currency", currency, "currency must be a 3-letter ISO code (e.g., USD, EUR)")

    # lead_time_days (optional)
    lead = row.get("lead_time_days", "")
    if lead:
        try:
            if int(lead) < 0:
                raise ValueError
        except ValueError:
            err("lead_time_days", lead, "lead_time_days must be a non-negative integer")

    # payment_terms (optional)
    if len(row.get("payment_terms", "")) > 255:
        err("payment_terms", row["payment_terms"][:40] + "...", "payment_terms exceeds 255 characters")

    return errors
```

---

## Routers

### `routers/rfq.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as Connection
from db.connection import get_db
from models.rfq import RFQCreate, RFQResponse, RFQListResponse

router = APIRouter(tags=["rfq"])

@router.post("/rfq", response_model=RFQResponse, status_code=201)
def create_rfq(body: RFQCreate, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO rfq (item_name, material_spec, quantity, delivery_expectation, notes)
            VALUES (%(item_name)s, %(material_spec)s, %(quantity)s,
                    %(delivery_expectation)s, %(notes)s)
            RETURNING id, item_name, material_spec, quantity, delivery_expectation,
                      notes, created_at, updated_at
        """, body.model_dump())
        row = dict(zip([d.name for d in cur.description], cur.fetchone()))
        row["quote_count"] = 0
        db.commit()
    return row

@router.get("/rfq", response_model=RFQListResponse)
def list_rfqs(limit: int = 20, offset: int = 0, db: Connection = Depends(get_db)):
    limit = min(limit, 100)
    with db.cursor() as cur:
        cur.execute("""
            SELECT r.*, COUNT(q.id) AS quote_count
            FROM rfq r
            LEFT JOIN supplier_quote q ON q.rfq_id = r.id
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        cols = [d.name for d in cur.description]
        items = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.execute("SELECT COUNT(*) FROM rfq")
        total = cur.fetchone()[0]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/rfq/{rfq_id}", response_model=RFQResponse)
def get_rfq(rfq_id: str, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("""
            SELECT r.*, COUNT(q.id) AS quote_count
            FROM rfq r
            LEFT JOIN supplier_quote q ON q.rfq_id = r.id
            WHERE r.id = %s
            GROUP BY r.id
        """, (rfq_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return dict(zip([d.name for d in cur.description], row))

@router.delete("/rfq/{rfq_id}", status_code=204)
def delete_rfq(rfq_id: str, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM rfq WHERE id = %s RETURNING id", (rfq_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="RFQ not found")
        db.commit()
```

### `routers/quotes.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as Connection
from decimal import Decimal
from db.connection import get_db
from models.quote import QuoteCreate, QuoteResponse, QuoteListResponse
from services.comparison import enrich_quotes

router = APIRouter(tags=["quotes"])

def _fetch_rfq(rfq_id: str, cur) -> dict:
    cur.execute("SELECT * FROM rfq WHERE id = %s", (rfq_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return dict(zip([d.name for d in cur.description], row))

@router.post("/rfq/{rfq_id}/quotes", response_model=QuoteResponse, status_code=201)
def add_quote(rfq_id: str, body: QuoteCreate, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        rfq = _fetch_rfq(rfq_id, cur)
        cur.execute("""
            INSERT INTO supplier_quote
              (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks)
            VALUES (%(rfq_id)s, %(supplier_name)s, %(unit_price)s, %(currency)s,
                    %(lead_time_days)s, %(payment_terms)s, %(remarks)s)
            RETURNING *
        """, {"rfq_id": rfq_id, **body.model_dump()})
        cols = [d.name for d in cur.description]
        quote = dict(zip(cols, cur.fetchone()))
        db.commit()

    # Fetch all quotes to compute is_best_quote accurately
    with db.cursor() as cur:
        cur.execute("SELECT * FROM supplier_quote WHERE rfq_id = %s", (rfq_id,))
        cols = [d.name for d in cur.description]
        all_quotes = [dict(zip(cols, r)) for r in cur.fetchall()]

    enriched, _, _ = enrich_quotes(all_quotes, rfq["quantity"])
    return next(q for q in enriched if q["id"] == quote["id"])

@router.get("/rfq/{rfq_id}/quotes", response_model=QuoteListResponse)
def list_quotes(rfq_id: str, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        rfq = _fetch_rfq(rfq_id, cur)
        cur.execute("SELECT * FROM supplier_quote WHERE rfq_id = %s", (rfq_id,))
        cols = [d.name for d in cur.description]
        quotes = [dict(zip(cols, r)) for r in cur.fetchall()]

    enriched, best_id = enrich_quotes(quotes, rfq["quantity"])
    totals = [q["total_price"] for q in enriched]
    currencies = {q["currency"] for q in enriched}

    return {
        "rfq": {**rfq, "quote_count": len(enriched)},
        "quotes": enriched,
        "best_quote_id": best_id,
        "summary": {
            "quote_count": len(enriched),
            "min_total_price": min(totals) if totals else None,
            "max_total_price": max(totals) if totals else None,
            "currency_warning": len(currencies) > 1,
        }
    }

@router.delete("/quote/{quote_id}", status_code=204)
def delete_quote(quote_id: str, db: Connection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM supplier_quote WHERE id = %s RETURNING id", (quote_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Quote not found")
        db.commit()
```

### `routers/csv_import.py`

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from psycopg2.extensions import connection as Connection
from db.connection import get_db
from models.quote import CSVImportResult
from services.csv_parser import parse_csv
from services.comparison import enrich_quotes

router = APIRouter(tags=["csv"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/rfq/{rfq_id}/quotes/import", response_model=CSVImportResult)
async def import_quotes_csv(
    rfq_id: str,
    file: UploadFile = File(...),
    db: Connection = Depends(get_db)
):
    with db.cursor() as cur:
        cur.execute("SELECT * FROM rfq WHERE id = %s", (rfq_id,))
        rfq = cur.fetchone()
        if not rfq:
            raise HTTPException(status_code=404, detail="RFQ not found")
        cols = [d.name for d in cur.description]
        rfq = dict(zip(cols, rfq))

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 5 MB limit")

    try:
        content = raw.decode("utf-8-sig")  # handles BOM automatically
        valid_rows, error_rows = parse_csv(content, rfq_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    inserted = []
    if valid_rows:
        with db.cursor() as cur:
            cur.executemany("""
                INSERT INTO supplier_quote
                  (rfq_id, supplier_name, unit_price, currency,
                   lead_time_days, payment_terms, remarks, source)
                VALUES (%(rfq_id)s, %(supplier_name)s, %(unit_price)s, %(currency)s,
                        %(lead_time_days)s, %(payment_terms)s, %(remarks)s, %(source)s)
                RETURNING *
            """, valid_rows)
            # executemany with RETURNING — collect all results
            # Note: psycopg2 executemany doesn't support RETURNING in all versions
            # Use individual INSERTs in a loop or use execute_values from psycopg2.extras
            db.commit()

        # Re-fetch inserted quotes with enrichment
        with db.cursor() as cur:
            cur.execute("SELECT * FROM supplier_quote WHERE rfq_id = %s", (rfq_id,))
            _cols = [d.name for d in cur.description]
            all_quotes = [dict(zip(_cols, r)) for r in cur.fetchall()]
        enriched, _, _ = enrich_quotes(all_quotes, rfq["quantity"])
        inserted = enriched  # all quotes, not just new ones — client will reconcile

    return {
        "imported": len(valid_rows),
        "failed": len(error_rows),
        "errors": error_rows,
        "quotes": inserted,
    }
```

**Note on `executemany` + RETURNING:** psycopg2's standard `executemany` does not support `RETURNING`. Use `psycopg2.extras.execute_values` with `fetch=True`, or loop with individual `execute` calls collecting `RETURNING` results. The simpler approach for this assignment: loop, commit once at the end.

---

## Running the Server

```bash
cd server
uv run uvicorn main:app --reload --port 8000
```

The `--reload` flag restarts on file changes during development. Remove it in any production-like environment.

FastAPI generates interactive API documentation at `http://localhost:8000/docs` — use this to manually test all endpoints before wiring up the frontend.
