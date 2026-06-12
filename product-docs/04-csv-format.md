# CSV Import Format

## Design Philosophy

The CSV format is **canonical with aliases**: the system defines a fixed set of column names but accepts common synonyms so procurement teams can import directly from spreadsheets without reformatting headers.

**Scope decision for this assignment:** The format is documented here and enforced server-side. The user does not configure the mapping; they use the canonical headers (or accepted aliases). This keeps validation deterministic and error messages precise.

---

## Canonical Column Headers

The CSV must have a header row. Column order is flexible. Headers are case-insensitive.

| Canonical Name | Required | Accepted Aliases |
|---|---|---|
| `supplier_name` | **Yes** | `supplier`, `vendor`, `vendor_name`, `company` |
| `unit_price` | **Yes** | `price`, `unit_cost`, `cost` |
| `currency` | No (default: `USD`) | `currency_code`, `curr` |
| `lead_time_days` | No | `lead_time`, `lead_days`, `days` |
| `payment_terms` | No | `terms`, `payment` |
| `remarks` | No | `notes`, `comment`, `comments` |

---

## Sample CSV

Save as `sample_quotes.csv` in the repository root. This file is included in the submission.

```csv
supplier_name,unit_price,currency,lead_time_days,payment_terms,remarks
Acme Metals,12.75,USD,14,Net 30,Includes shipping
Global Steel,11.50,USD,21,Net 45,FOB origin
Pacific Supplies,13.20,USD,7,COD,Express delivery available
Eastern Components,11.50,EUR,18,Net 60,Price in EUR — check conversion
```

This sample deliberately includes one EUR quote to trigger the `currency_warning` in the comparison response.

---

## Validation Rules

### File-Level

| Rule | Behavior on Failure |
|---|---|
| File must be parseable as CSV | HTTP 400: `"File is not valid CSV"` |
| File size ≤ 5 MB | HTTP 400: `"File exceeds 5 MB limit"` |
| `supplier_name` column must be present | HTTP 400: `"Required columns missing: supplier_name"` |
| `unit_price` column must be present | HTTP 400: `"Required columns missing: unit_price"` |
| Must have at least one data row (beyond header) | HTTP 400: `"CSV file contains no data rows"` |
| Encoding: UTF-8 (with or without BOM) | BOM is stripped automatically |

### Row-Level Validation Matrix

| Field | Required | Type | Rules | Error Message |
|---|---|---|---|---|
| `supplier_name` | Yes | string | Non-empty after whitespace strip; max 255 chars | `"supplier_name is required"` / `"supplier_name exceeds 255 characters"` |
| `unit_price` | Yes | decimal | Parseable as a number; >= 0 | `"unit_price must be a non-negative number"` |
| `currency` | No | string | Exactly 3 letters after coercion to uppercase | `"currency must be a 3-letter ISO code (e.g., USD, EUR)"` |
| `lead_time_days` | No | integer | Parseable as whole number; >= 0 | `"lead_time_days must be a non-negative integer"` |
| `payment_terms` | No | string | Max 255 chars | `"payment_terms exceeds 255 characters"` |
| `remarks` | No | string | No length limit | — |

**Blank cell behavior:**
- A blank cell for a required field (`supplier_name`, `unit_price`) → row-level error
- A blank cell for an optional field → field is treated as `null`/omitted
- A row where every cell is blank → silently skipped (not counted as an error or import)

---

## Parser Behavior

Implemented in `server/services/csv_parser.py`.

```python
def parse_csv(
    file_content: str,
    rfq_id: UUID
) -> tuple[list[dict], list[dict]]:
    """
    Returns:
        valid_rows:  list of dicts ready for INSERT into supplier_quote
        error_rows:  list of {row, column, value, message} dicts
    """
```

**Processing steps:**

1. **Strip BOM** — handle UTF-8-with-BOM files exported from Excel
2. **Parse with `csv.DictReader`** — handles quoted fields, embedded commas, and newlines within cells natively
3. **Normalize headers** — lowercase, strip whitespace, apply alias map
4. **Check required columns** — raise HTTP 400 if `supplier_name` or `unit_price` are absent
5. **Iterate rows** — for each row:
   - Skip if all cells are empty
   - Strip whitespace from all values
   - Coerce `currency` to uppercase
   - Parse `unit_price` as `Decimal` (not `float` — preserves precision)
   - Validate each field per the matrix above
   - If valid: append to `valid_rows` with `source='csv'` and `rfq_id` set
   - If invalid: append all field errors for that row to `error_rows`

**A row with multiple invalid fields generates one error entry per failed field**, not just the first one. This gives the user the full picture to fix their CSV in one round trip.

---

## Error Response to User

The API returns a structured error list:

```json
{
  "imported": 2,
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

The `row` number corresponds to the data row number (1-indexed, not counting the header row). Row 1 is the first data row.

### UI Error Display

After an import, the frontend shows:

**Success/failure banner:**
```
4 quotes imported successfully. 1 row failed — see errors below.
```

**Error table (if errors exist):**

| Row | Field | Value | Error |
|---|---|---|---|
| 3 | unit_price | abc | unit_price must be a non-negative number |

Successfully imported quotes appear immediately in the comparison table — the user does not need to refresh. Failed rows are their responsibility to fix and re-import. Re-importing is safe: there is no deduplication, and the same supplier can appear multiple times.

---

## Bulk Insert Strategy

Valid rows are inserted in a single `executemany` call after all rows are parsed. This means:

- If the database insert fails for any reason after parsing, **no rows are committed** (the entire batch is atomic)
- Row-level validation errors (from parsing) do not affect this atomicity — only DB-level failures do

In practice, if parsing succeeded, the DB insert almost never fails (all values are already validated). The atomicity boundary is primarily a defense against schema mismatches during development.
