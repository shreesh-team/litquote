# API Specification

## Conventions

- **Base URL:** `http://localhost:8000/api`
- **Content-Type:** `application/json` for all responses
- **IDs:** UUID v4 strings (e.g., `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`)
- **Timestamps:** ISO 8601 with timezone offset (`"2026-06-12T10:30:00Z"`)
- **Decimals:** Returned as JSON numbers; no currency symbols
- **Interactive docs:** `http://localhost:8000/docs` (FastAPI auto-generates Swagger UI)

### Validation Error Shape (422)

Pydantic v2 returns this structure automatically for invalid request bodies:

```json
{
  "detail": [
    {
      "loc": ["body", "quantity"],
      "msg": "Input should be greater than 0",
      "type": "greater_than"
    }
  ]
}
```

### Not Found Shape (404)

```json
{ "detail": "RFQ not found" }
```

---

## RFQ Endpoints

### `POST /api/rfq` — Create RFQ

**Request Body:**

```json
{
  "item_name": "Steel Pipe",
  "material_spec": "ASTM A53 Grade B, 2-inch diameter",
  "quantity": 500,
  "delivery_expectation": "2026-08-01",
  "notes": "Surface must be galvanized"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `item_name` | string | Yes | Non-empty, max 255 chars |
| `material_spec` | string | No | Any length |
| `quantity` | number | Yes | > 0 |
| `delivery_expectation` | string (ISO date) | No | Format: `YYYY-MM-DD` |
| `notes` | string | No | Any length |

**Response 201:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "item_name": "Steel Pipe",
  "material_spec": "ASTM A53 Grade B, 2-inch diameter",
  "quantity": 500,
  "delivery_expectation": "2026-08-01",
  "notes": "Surface must be galvanized",
  "created_at": "2026-06-12T10:30:00Z",
  "updated_at": "2026-06-12T10:30:00Z",
  "quote_count": 0
}
```

---

### `GET /api/rfq` — List RFQs

**Query Parameters:**

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| `limit` | integer | 20 | 100 | Page size |
| `offset` | integer | 0 | — | Skip N results |

**Response 200:**

```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "item_name": "Steel Pipe",
      "material_spec": "ASTM A53 Grade B, 2-inch diameter",
      "quantity": 500,
      "delivery_expectation": "2026-08-01",
      "notes": "Surface must be galvanized",
      "created_at": "2026-06-12T10:30:00Z",
      "updated_at": "2026-06-12T10:30:00Z",
      "quote_count": 3
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Items are sorted by `created_at DESC` (newest first). `quote_count` is computed via a subquery.

---

### `GET /api/rfq/{rfq_id}` — Get RFQ

**Path Parameter:** `rfq_id` (UUID)

**Response 200:** Same shape as a single item from `GET /api/rfq` (includes `quote_count`).

**Response 404:** `{ "detail": "RFQ not found" }`

---

### `DELETE /api/rfq/{rfq_id}` — Delete RFQ

**Path Parameter:** `rfq_id` (UUID)

**Response 204:** No body. Cascades to all associated quotes.

**Response 404:** `{ "detail": "RFQ not found" }`

---

## Quote Endpoints

### `POST /api/rfq/{rfq_id}/quotes` — Add Quote

**Path Parameter:** `rfq_id` (UUID)

**Request Body:**

```json
{
  "supplier_name": "Acme Metals",
  "unit_price": 12.75,
  "currency": "USD",
  "lead_time_days": 14,
  "payment_terms": "Net 30",
  "remarks": "Includes shipping"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `supplier_name` | string | Yes | Non-empty, max 255 chars |
| `unit_price` | number | Yes | >= 0 (allows free samples) |
| `currency` | string | No (default: `"USD"`) | Exactly 3 letters, coerced to uppercase |
| `lead_time_days` | integer | No | >= 0 |
| `payment_terms` | string | No | Max 255 chars |
| `remarks` | string | No | Any length |

**Response 201:**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "rfq_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "supplier_name": "Acme Metals",
  "unit_price": 12.75,
  "currency": "USD",
  "lead_time_days": 14,
  "payment_terms": "Net 30",
  "remarks": "Includes shipping",
  "source": "manual",
  "total_price": 6375.00,
  "is_best_quote": false,
  "created_at": "2026-06-12T10:35:00Z"
}
```

`total_price` = `unit_price × rfq.quantity`. `is_best_quote` reflects the global minimum across all quotes on this RFQ at the time of the request.

**Response 404:** `{ "detail": "RFQ not found" }` — if `rfq_id` does not exist.

---

### `GET /api/rfq/{rfq_id}/quotes` — Compare Quotes

**Path Parameter:** `rfq_id` (UUID)

This is the core comparison endpoint. It returns the full enriched quote list alongside summary statistics.

**Response 200:**

```json
{
  "rfq": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "item_name": "Steel Pipe",
    "quantity": 500,
    "delivery_expectation": "2026-08-01",
    "quote_count": 3
  },
  "quotes": [
    {
      "id": "b8a4c3d2-1234-5678-abcd-ef1234567890",
      "rfq_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "supplier_name": "Global Steel",
      "unit_price": 11.50,
      "currency": "USD",
      "lead_time_days": 21,
      "payment_terms": "Net 45",
      "remarks": "FOB origin",
      "source": "manual",
      "total_price": 5750.00,
      "is_best_quote": true,
      "created_at": "2026-06-12T10:36:00Z"
    },
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "rfq_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "supplier_name": "Acme Metals",
      "unit_price": 12.75,
      "currency": "USD",
      "lead_time_days": 14,
      "payment_terms": "Net 30",
      "remarks": "Includes shipping",
      "source": "manual",
      "total_price": 6375.00,
      "is_best_quote": false,
      "created_at": "2026-06-12T10:35:00Z"
    }
  ],
  "best_quote_id": "b8a4c3d2-1234-5678-abcd-ef1234567890",
  "summary": {
    "quote_count": 2,
    "lowest_total": 5750.00,
    "highest_total": 6375.00,
    "currency_warning": false
  }
}
```

**Key response semantics:**

| Field | Description |
|---|---|
| `quotes` | Sorted by `total_price` ASC (cheapest first) |
| `best_quote_id` | ID of the quote with the lowest `total_price`. `null` if no quotes exist |
| `is_best_quote` | `true` for all quotes that tie at the lowest total (multiple can be `true`) |
| `currency_warning` | `true` when quotes have mixed currencies — the numeric comparison is unreliable |
| `summary.lowest_total` | The minimum `total_price` across all quotes on this RFQ |

**Response 404:** `{ "detail": "RFQ not found" }`

**Empty quotes case:**

```json
{
  "rfq": { ... },
  "quotes": [],
  "best_quote_id": null,
  "summary": {
    "quote_count": 0,
    "lowest_total": null,
    "highest_total": null,
    "currency_warning": false
  }
}
```

---

### `DELETE /api/quote/{quote_id}` — Delete Quote

**Path Parameter:** `quote_id` (UUID)

Note: the path is `/api/quote/{quote_id}` (no `rfq_id` needed — quotes have globally unique UUIDs).

**Response 204:** No body.

**Response 404:** `{ "detail": "Quote not found" }`

---

## CSV Import Endpoint

### `POST /api/rfq/{rfq_id}/quotes/import` — Import Quotes from CSV

**Path Parameter:** `rfq_id` (UUID)

**Request:** `multipart/form-data` with a single field `file` containing the CSV file.

**This endpoint always returns HTTP 200**, even if all rows fail. The client must inspect the response body to determine what happened. A 400 is returned only for file-level failures (not valid CSV, file too large).

**Response 200 — partial or full success:**

```json
{
  "imported": 4,
  "failed": 1,
  "errors": [
    {
      "row": 3,
      "column": "unit_price",
      "value": "abc",
      "message": "unit_price must be a non-negative number"
    }
  ],
  "quotes": [
    {
      "id": "...",
      "supplier_name": "Global Steel",
      "unit_price": 11.50,
      "currency": "USD",
      "total_price": 5750.00,
      "is_best_quote": true,
      "source": "csv",
      ...
    }
  ]
}
```

**Response 200 — all rows failed:**

```json
{
  "imported": 0,
  "failed": 3,
  "errors": [ ... ],
  "quotes": []
}
```

**Response 400 — file-level errors:**

```json
{ "detail": "File is not valid CSV" }
{ "detail": "File exceeds 5 MB limit" }
{ "detail": "Required columns missing: supplier_name, unit_price" }
```

**Response 404:** `{ "detail": "RFQ not found" }`

The `quotes` array in the response contains the enriched quote objects (with `total_price` and `is_best_quote`) for all successfully imported rows. The frontend appends these directly to the comparison table without a second fetch.

---

## Health Endpoint

### `GET /api/health`

**Response 200:**

```json
{ "status": "ok", "db": "connected" }
```

**Response 200 (DB unreachable):**

```json
{ "status": "ok", "db": "disconnected" }
```

The health endpoint never returns a non-200 status — it is used for liveness checks and should always respond, even when the database is down. The `db` field communicates database reachability separately.
