# API Specification

## Conventions

- **Base URL:** `http://localhost:8000/api`
- **Content-Type:** `application/json` for all responses
- **IDs:** UUID v4 strings (e.g., `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`)
- **Timestamps:** ISO 8601 with timezone offset (`"2026-06-12T10:30:00Z"`)
- **Decimals:** Returned as JSON numbers; no currency symbols
- **Interactive docs:** `http://localhost:8000/docs` (FastAPI auto-generates Swagger UI)

### Validation Error Shape (422)

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

### Conflict Shape (409)

Returned when a mutation is attempted on a locked RFQ:

```json
{ "detail": "This RFQ has been awarded and is locked." }
{ "detail": "This RFQ has been voided and cannot be modified." }
```

---

## RFQ Status Lifecycle

```
open ──► awarded ──► void
  └──────────────────►
```

- `open` — default state; all mutations allowed
- `awarded` — set via `POST /award`; RFQ and quotes are locked (read-only); can only transition to `void`
- `void` — terminal state; set via `POST /void`; nothing can be modified

Status is only changed via the dedicated `/award` and `/void` endpoints. `PUT /api/rfq/{rfq_id}` does **not** accept a `status` field.

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
  "status": "open",
  "awarded_quote_id": null,
  "created_at": "2026-06-12T10:30:00Z",
  "updated_at": "2026-06-12T10:30:00Z",
  "quote_count": 0
}
```

---

### `GET /api/rfq` — List RFQs

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Page size |
| `offset` | integer | 0 | Skip N results |
| `search` | string | — | Filter by `item_name` (case-insensitive substring match) |

**Response 200:**

```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "item_name": "Steel Pipe",
      "quantity": 500,
      "delivery_expectation": "2026-08-01",
      "status": "open",
      "awarded_quote_id": null,
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

Items sorted by `created_at DESC`. `quote_count` is computed via subquery. `total` reflects the count after applying any `search` filter.

---

### `GET /api/rfq/{rfq_id}` — Get RFQ

**Response 200:** Same shape as a single item from `GET /api/rfq`.

**Response 404:** `{ "detail": "RFQ not found" }`

---

### `PUT /api/rfq/{rfq_id}` — Edit RFQ

Only `open` RFQs can be edited. Returns 409 if status is `awarded` or `void`. All fields are optional (partial update).

**Request Body:**

```json
{
  "item_name": "Steel Pipe — Revised",
  "quantity": 600
}
```

| Field | Type | Validation |
|---|---|---|
| `item_name` | string | Non-empty, max 255 chars |
| `material_spec` | string \| null | Any length |
| `quantity` | number | > 0 |
| `delivery_expectation` | string \| null | `YYYY-MM-DD` |
| `notes` | string \| null | Any length |

**Response 200:** Full `RFQResponse` with updated values.

**Response 404:** RFQ not found.

**Response 409:** `{ "detail": "Only open RFQs can be edited." }`

---

### `POST /api/rfq/{rfq_id}/award` — Award RFQ

Marks the RFQ as awarded and records which quote was selected. Only works from `open` status.

**Request Body:**

```json
{ "quote_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7" }
```

The `quote_id` must belong to the specified RFQ.

**Response 200:** Full `RFQResponse` with `status: "awarded"` and `awarded_quote_id` set.

**Response 400:** `{ "detail": "Quote does not belong to this RFQ" }`

**Response 404:** RFQ or quote not found.

---

### `POST /api/rfq/{rfq_id}/void` — Void RFQ

Transitions the RFQ to the terminal `void` state. Works from both `open` and `awarded`. Irreversible.

**Request Body:** None.

**Response 200:** Full `RFQResponse` with `status: "void"`.

**Response 404:** RFQ not found.

---

### `DELETE /api/rfq/{rfq_id}` — Delete RFQ

**Response 204:** No body. Cascades to all associated quotes.

**Response 404:** `{ "detail": "RFQ not found" }`

---

## Quote Endpoints

### `POST /api/rfq/{rfq_id}/quotes` — Add Quote

Blocked when RFQ status is `awarded` or `void` (returns 409).

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
| `unit_price` | number | Yes | >= 0 |
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
  "is_awarded": false,
  "delivery_risk": false,
  "created_at": "2026-06-12T10:35:00Z"
}
```

**Response 409:** RFQ is locked (awarded or void).

---

### `GET /api/rfq/{rfq_id}/quotes` — List & Compare Quotes

**Response 200:**

```json
{
  "rfq": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "item_name": "Steel Pipe",
    "quantity": 500,
    "delivery_expectation": "2026-08-01",
    "status": "awarded",
    "awarded_quote_id": "b8a4c3d2-1234-5678-abcd-ef1234567890",
    "quote_count": 2
  },
  "quotes": [
    {
      "id": "b8a4c3d2-1234-5678-abcd-ef1234567890",
      "supplier_name": "Global Steel",
      "unit_price": 11.50,
      "currency": "USD",
      "total_price": 5750.00,
      "is_best_quote": true,
      "is_awarded": true,
      "delivery_risk": true,
      "lead_time_days": 21,
      "source": "manual"
    }
  ],
  "best_quote_id": "b8a4c3d2-1234-5678-abcd-ef1234567890",
  "summary": {
    "quote_count": 2,
    "min_total_price": 5750.00,
    "max_total_price": 6375.00,
    "currency_warning": false
  }
}
```

**Key response fields:**

| Field | Description |
|---|---|
| `quotes` | Sorted by `total_price` ASC; ties broken by `lead_time_days` ASC (no lead time sorts last) |
| `is_best_quote` | `true` for all quotes tied at the minimum total price |
| `is_awarded` | `true` for the single quote recorded in `rfq.awarded_quote_id` |
| `delivery_risk` | `true` when `today + lead_time_days > rfq.delivery_expectation`; `false` if either is null |
| `currency_warning` | `true` when quotes span more than one distinct currency |

---

### `PUT /api/quote/{quote_id}` — Edit Quote

Blocked when the parent RFQ status is `awarded` or `void` (returns 409). All fields optional.

**Request Body:** Same fields as `POST /api/rfq/{rfq_id}/quotes`, all optional.

**Response 200:** Full enriched `QuoteResponse` (same shape as add quote response).

**Response 404:** Quote not found.

**Response 409:** Parent RFQ is locked.

---

### `DELETE /api/quote/{quote_id}` — Delete Quote

Blocked when the parent RFQ status is `awarded` or `void` (returns 409).

**Response 204:** No body.

**Response 404:** `{ "detail": "Quote not found" }`

**Response 409:** Parent RFQ is locked.

---

## CSV Import Endpoint

### `POST /api/rfq/{rfq_id}/quotes/import` — Bulk Import from CSV

Blocked when RFQ status is `awarded` or `void` (returns 409).

**Request:** `multipart/form-data` with a single field `file`.

Always returns HTTP 200 (inspect body to check results). Returns 400 only for file-level failures.

**Response 200:**

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
  "quotes": [ ... ]
}
```

**Response 400:** Invalid CSV, file too large, required columns missing.

**Response 409:** RFQ is locked.

---

## Health Endpoint

### `GET /api/health`

```json
{ "status": "ok", "db": "connected" }
```

Never returns non-200. `db` field communicates database reachability separately.
