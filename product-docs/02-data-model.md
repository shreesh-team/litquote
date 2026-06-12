# Data Model

## Entity Overview

The data model has two tables:

- **`rfq`** — the root aggregate. Represents a single procurement request for a specific item.
- **`supplier_quote`** — child of `rfq`. Each quote is one supplier's response to an RFQ.

`total_price` and `is_best_quote` are **computed values, never stored**. They are calculated in the service layer on every read, keeping the DB as the single source of truth for raw data while the application layer owns business logic.

---

## Entity Relationship

```
rfq (1) ──────────────── (0..*) supplier_quote
         ON DELETE CASCADE
```

Deleting an RFQ atomically removes all its quotes. There is no independent existence for a quote outside of its RFQ.

---

## DDL — `server/db/migrations/001_initial_schema.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE rfq (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name            VARCHAR(255) NOT NULL,
    material_spec        TEXT,
    quantity             NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    delivery_expectation DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE supplier_quote (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id         UUID         NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
    supplier_name  VARCHAR(255) NOT NULL,
    unit_price     NUMERIC(15, 4) NOT NULL CHECK (unit_price >= 0),
    currency       CHAR(3)      NOT NULL DEFAULT 'USD',
    lead_time_days INTEGER      CHECK (lead_time_days >= 0),
    payment_terms  VARCHAR(255),
    remarks        TEXT,
    source         VARCHAR(20)  NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('manual', 'csv')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_quote_rfq_id ON supplier_quote(rfq_id);
CREATE INDEX idx_rfq_created_at        ON rfq(created_at DESC);
```

---

## Field Reference

### `rfq`

| Column | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | UUIDs prevent sequential ID enumeration; `pgcrypto` is built into PostgreSQL 13+ |
| `item_name` | VARCHAR(255) | No | — | Required; 255 is sufficient for any part name |
| `material_spec` | TEXT | Yes | — | Open-ended; TEXT allows any length specification string |
| `quantity` | NUMERIC(15,4) | No | — | Supports fractional quantities (kg, liters, meters); CHECK > 0 prevents nonsensical zero-quantity RFQs |
| `delivery_expectation` | DATE | Yes | — | Date-only (no time); time-of-day is irrelevant for delivery windows |
| `notes` | TEXT | Yes | — | Free-form; no length constraint |
| `created_at` | TIMESTAMPTZ | No | `now()` | Always UTC; includes timezone offset |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Application must update this on any PATCH; not triggered automatically (no triggers needed at this scope) |

### `supplier_quote`

| Column | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Same rationale as `rfq.id` |
| `rfq_id` | UUID | No | — | FK with CASCADE — cannot orphan a quote |
| `supplier_name` | VARCHAR(255) | No | — | Required; the minimum useful piece of information on a quote |
| `unit_price` | NUMERIC(15,4) | No | — | **Not FLOAT** — floating-point arithmetic introduces rounding errors on money. NUMERIC is exact. CHECK >= 0 allows free samples (unit_price = 0) |
| `currency` | CHAR(3) | No | `'USD'` | ISO 4217 three-letter code. CHAR(3) enforces exactly 3 characters at the DB level |
| `lead_time_days` | INTEGER | Yes | — | Duration in days is simpler and more queryable than a delivery date (which would require knowing the RFQ issue date) |
| `payment_terms` | VARCHAR(255) | Yes | — | Free text; "Net 30", "COD", "50% upfront" are all valid |
| `remarks` | TEXT | Yes | — | Open-ended additional context from the supplier |
| `source` | VARCHAR(20) | No | `'manual'` | Audit flag distinguishing manually-entered quotes from CSV-imported ones. Enables filtering and debugging without schema changes |
| `created_at` | TIMESTAMPTZ | No | `now()` | No `updated_at` — quotes are immutable after creation in this version |

---

## Computed Values (Never Stored)

### `total_price`

```
total_price = supplier_quote.unit_price × rfq.quantity
```

Computed in `services/comparison.py` for every quote when a quote list is returned. Not a DB column because:
- Storing it would create a derived value that could drift out of sync if an RFQ's quantity changes
- Computing it is O(n) and trivially fast

### `is_best_quote`

```
is_best_quote = (quote.total_price == MIN(total_price) over all quotes in this RFQ)
```

Also computed in `services/comparison.py`. Multiple quotes can tie for best (e.g., two suppliers both quote the same total). `best_quote_id` in the response holds the ID of the first best quote (sorted by `created_at`).

**Note:** If quotes have mixed currencies, `is_best_quote` and `best_quote_id` are still computed (the comparison proceeds on raw numeric values), but the API response includes `currency_warning: true` to signal that the comparison may be meaningless.

---

## Migration Strategy

Migrations are plain numbered `.sql` files run at application startup via FastAPI's `lifespan` context manager:

```
server/db/migrations/
  001_initial_schema.sql   ← DDL above
  002_seed_data.sql        ← sample data (gated by SEED_DB env var)
```

`db/connection.py` tracks which migrations have run using a `schema_migrations` table (created on first startup):

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(10) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Each migration file is run only once; its version string (e.g., `"001"`) is inserted into `schema_migrations` after successful execution.

---

## Seed Data — `server/db/migrations/002_seed_data.sql`

Only runs when `SEED_DB=true` in the environment. Provides one RFQ with three quotes for immediate demo use.

```sql
INSERT INTO rfq (item_name, material_spec, quantity, delivery_expectation, notes)
VALUES (
    'Steel Pipe',
    'ASTM A53 Grade B, 2-inch diameter, Schedule 40',
    500,
    '2026-08-01',
    'Surface must be hot-dip galvanized. Bundled delivery preferred.'
);

-- The UUID is captured via a CTE
WITH inserted_rfq AS (
    SELECT id FROM rfq ORDER BY created_at DESC LIMIT 1
)
INSERT INTO supplier_quote (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks)
SELECT
    id,
    unnest(ARRAY['Acme Metals',    'Global Steel',   'Pacific Supplies']),
    unnest(ARRAY[12.75,            11.50,            13.20]),
    'USD',
    unnest(ARRAY[14,               21,               7]),
    unnest(ARRAY['Net 30',         'Net 45',         'COD']),
    unnest(ARRAY['Includes shipping', 'FOB origin', 'Express delivery available'])
FROM inserted_rfq;
```

Expected result: Acme total = $6,375 | Global total = $5,750 (**best**) | Pacific total = $6,600.

---

## Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_supplier_quote_rfq_id` | `supplier_quote` | `rfq_id` | Speeds up `SELECT ... WHERE rfq_id = $1` — the dominant query pattern |
| `idx_rfq_created_at` | `rfq` | `created_at DESC` | Speeds up the default sort on the RFQ list page |
