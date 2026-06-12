# Plan: CSV Import (Feature Spec 04)

## Context

Procurement users need to bulk-import supplier quotes from CSV files rather than entering them one by one. The database schema, quote enrichment service, and QuoteTable source badge styling are already in place. The three stub files (`csv_import.py`, `csv_parser.py`, `useCSVImport.js`) have been created, and the RFQ detail page has an "Upload Quotes" button that opens a CSV Import modal.

**Post-initial-implementation changes:**
- UI moved from inline page section → `CSVImportModal.jsx` (triggered by "Upload Quotes" button before "+ Add Quote")
- Deduplication added: within-file (silent, first occurrence wins) and against DB rows (row-level error)

---

## Backend

### 1. `server/services/csv_parser.py` (new file)

**Responsibilities:** parse raw CSV bytes → validated row dicts + per-row error list

- Accept `bytes` content (decoded as UTF-8; fallback to latin-1)
- Column aliasing: map all accepted aliases to canonical names (case-insensitive header match)
- Skip fully blank rows silently
- Within-file dedup: after validation passes, check `(supplier_name, unit_price, currency)` against a `seen` set; silently skip subsequent occurrences (first wins)
- Attach `_row` number to each valid row dict so the router can report row numbers for DB-level rejections
- Return `(valid_rows: list[dict], errors: list[dict])` where each error has `{row, column, value, message}`

**Validation rules per spec:**
- `supplier_name`: required, non-empty, max 255 chars
- `unit_price`: required, parseable as `Decimal`, >= 0
- `currency`: optional; coerce to uppercase; must be 3 letters if present; default to `"USD"` when blank
- `lead_time_days`: optional; non-negative integer if present
- `payment_terms`: optional; max 255 chars
- `remarks`: optional; no limit

**Column alias map:**
```python
ALIASES = {
    "supplier_name": ["supplier", "vendor", "vendor_name", "company"],
    "unit_price":    ["price", "unit_cost", "cost"],
    "currency":      ["currency_code", "curr"],
    "lead_time_days":["lead_time", "lead_days", "days"],
    "payment_terms": ["terms", "payment"],
    "remarks":       ["notes", "comment", "comments"],
}
```

---

### 2. `server/routers/csv_import.py` (new file)

**Endpoint:** `POST /api/rfq/{rfq_id}/quotes/import`  
**Content-type:** `multipart/form-data`, field `file`

**File-level checks (→ HTTP 400 on failure):**
- File size > 5 MB: `"File exceeds the 5 MB size limit."`
- CSV parse failure: `"The file could not be parsed as CSV."`
- Missing `supplier_name` column: `"Required column 'supplier_name' is missing."`
- Missing `unit_price` column: `"Required column 'unit_price' is missing."`
- Zero data rows after skipping blanks: `"The CSV file contains no data rows."`

**Happy path (→ HTTP 200 always):**
1. Call `csv_parser.parse()` to get `(valid_rows, errors)` — valid_rows include `_row` numbers
2. Query existing `(supplier_name, unit_price, currency)` tuples for this RFQ from the DB
3. For each valid row: if its key exists in the DB set → add a row-level error and skip; otherwise add to `rows_to_insert` and add key to the set (prevents two new rows from the same file colliding)
4. Insert `rows_to_insert` in a **single transaction** with `source='csv'` — strip `_row` before INSERT  
   Follow the existing pattern in `server/routers/quotes.py:72-89` — use `INSERT ... RETURNING` with bare column names
5. Fetch enriched quotes via `enrich_quotes()` from `server/services/comparison.py`
6. Return `{imported, failed, errors, quotes}` — `quotes` contains only the newly inserted rows, enriched

**Register the router** in `server/main.py` with the same prefix/tags pattern as `rfq` and `quotes` routers.

---

## Frontend

### 3. `client/src/hooks/useCSVImport.js` (new file)

```js
// POST /api/rfq/:rfqId/quotes/import
// returns { importing, result, error, importCSV, reset }
```

- `importCSV(rfqId, file)` — builds `FormData`, posts via axios, stores result
- `result` shape: `{ imported, failed, errors, quotes }`
- `error` — file-level error string (from HTTP 400 `detail`)
- `reset()` — clears result/error (called when user picks a new file)

---

### 4. `client/src/components/CSVImportModal.jsx` (new file)

Modal triggered by "Upload Quotes" button in the Supplier Quotes section header (placed before "+ Add Quote").

**Modal UI elements:**
- File input (`.csv` only)
- Success/partial banner after import
- Row-level error table (Row | Field | Value | Error) if any rows failed
- Footer: "Download sample CSV" link (left), "Cancel"/"Done" + "Import Quotes" buttons (right)

**Sample CSV download**: client-side Blob URL inside the modal.

**Quote refresh**: calls `onSuccess()` (which triggers `fetchQuotes`) when closing after any rows were imported.

### 5. `client/src/pages/RFQDetailPage.jsx` (modify)

- Removed inline "Import from CSV" section
- Added "Upload Quotes" button (secondary style) before "+ Add Quote" in the section header
- Wires `CSVImportModal` with `rfqId`, `onSuccess={fetchQuotes}`, `onClose`

---

### 6. `sample_quotes.csv` (new file at repo root)

Three data rows matching the spec exactly.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `server/services/csv_parser.py` | Create ✓ |
| `server/routers/csv_import.py` | Create ✓ |
| `server/main.py` | Modify — register `csv_import` router ✓ |
| `client/src/hooks/useCSVImport.js` | Create ✓ |
| `client/src/components/CSVImportModal.jsx` | Create ✓ |
| `client/src/pages/RFQDetailPage.jsx` | Modify — "Upload Quotes" button + CSVImportModal ✓ |
| `sample_quotes.csv` | Create ✓ |

`CSVImportModal.jsx` imports `CreateRFQModal.css` for shared modal chrome (same pattern as `AddQuoteModal.jsx`).

---

## Reused Utilities

- `server/services/comparison.py` → `enrich_quotes()` for enriching imported quotes
- `server/db/connection.py` → `get_db` dependency injection
- `server/routers/quotes.py` lines 72-89 → INSERT pattern to follow
- `client/src/api/client.js` → axios instance (baseURL `/api`)
- `useQuotes.js` → `fetchQuotes()` to refresh table after import

---

## Verification

1. Start backend (`uv run uvicorn main:app --reload --port 8000`) and frontend (`npm run dev`)
2. Navigate to any RFQ detail page; click "Upload Quotes" → modal opens
3. Upload `sample_quotes.csv` → expect "3 quotes imported. 0 failed." and all 3 rows in the table with blue "CSV" badges after closing modal
4. Upload the same `sample_quotes.csv` again → expect "0 imported, 3 failed" with duplicate errors for all 3 rows
5. Upload a CSV where one row has the same supplier+price+currency as an existing quote but the rest are new → only the duplicate row is rejected
6. Upload a CSV with two identical rows → only one is imported, no error for the skipped duplicate
7. Upload a CSV where the same supplier appears twice with different prices → both rows import successfully
8. Upload a CSV with one invalid `unit_price` row → expect partial import + error table
9. Upload a CSV missing `supplier_name` header → expect 400 banner, no rows inserted
10. Upload a file > 5 MB → expect 400 banner
11. Verify mixed currencies (USD + EUR rows) → currency warning banner appears in comparison table
12. Click "Download sample CSV" → file downloads with correct 3-row content
