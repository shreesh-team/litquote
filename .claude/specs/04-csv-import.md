# Feature Spec 04 – CSV Import

## Overview

A procurement user can bulk-import supplier quotes for an RFQ by uploading a CSV file. This saves time when a procurement team has received quotes via email in spreadsheet form. The system validates each row individually, imports valid rows immediately, and reports row-level errors clearly so the user can fix and re-import without losing the successful rows.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| CSV-1 | procurement user | upload a CSV file of supplier quotes | I can add many quotes at once instead of entering them one by one |
| CSV-2 | procurement user | see which rows failed and why | I can fix my CSV and re-import without re-entering everything |
| CSV-3 | procurement user | have valid rows imported even when some fail | I don't lose all progress because of one bad row |
| CSV-4 | procurement user | download a sample CSV | I know the expected format without reading documentation |

---

## Functional Requirements

### CSV-1: Upload CSV

**Location:** "Upload Quotes" button in the Supplier Quotes section header on the RFQ detail page (`/rfq/:id`), placed to the left of the existing "+ Add Quote" button. Clicking it opens a **CSV Import modal**.

**Modal UI elements:**
- File input (accepts `.csv` only; no drag-and-drop required)
- "Import Quotes" button (modal footer, right)
- "Download sample CSV" link (modal footer, left — see CSV-4)
- "Cancel" / "Done" button (modal footer)

**Trigger:** User selects a file and clicks "Import Quotes".

**Request:** `POST /api/rfq/{rfq_id}/quotes/import` as `multipart/form-data` with `file` field.

**File-level validation (server enforces; client shows the resulting error):**

| Rule | Error Displayed |
|---|---|
| File must be valid CSV | "The file could not be parsed as CSV." |
| File size ≤ 5 MB | "File exceeds the 5 MB size limit." |
| Must contain `supplier_name` column (or alias) | "Required column 'supplier_name' is missing." |
| Must contain `unit_price` column (or alias) | "Required column 'unit_price' is missing." |
| Must have at least one data row | "The CSV file contains no data rows." |

These errors are returned as HTTP 400 and displayed as a banner inside the modal. They block all import — no rows are processed.

**Success behavior:**
- Summary banner appears inside the modal: "4 quotes imported successfully. 1 row failed — see errors below."
- The comparison table updates immediately when the modal is closed (or when any rows were imported)
- The file input resets (allows re-import)
- The footer button changes from "Cancel" to "Done" after a successful import

---

### CSV-2: Row-Level Error Reporting

**When some rows fail**, the response still has HTTP 200. The error section renders inside the modal below the summary banner:

**Error table columns:** Row | Field | Value | Error

Example:

| Row | Field | Value | Error |
|---|---|---|---|
| 3 | unit_price | abc | unit_price must be a non-negative number |
| 5 | currency | US | currency must be a 3-letter ISO code (e.g., USD, EUR) |
| 7 | supplier_name | (empty) | supplier_name is required |
| 9 | supplier_name | Acme Metals | a quote from 'Acme Metals' with price 12.75 USD already exists for this RFQ |

**Row numbering:** 1-indexed, counting only data rows (the header row is not row 1 — the first data row is row 1). This matches how the user sees rows in a spreadsheet.

**Multiple errors per row:** If a single row has two bad fields, both errors appear as separate table rows. The user sees the full picture in one pass.

**Error persistence:** The error table stays visible until the user triggers another import or closes the modal.

---

### CSV-3: Partial Import

**Design decision:** Partial success is the intended behavior, not a degraded mode. A procurement user with 20 quotes should not lose 19 valid imports because row 7 has a typo.

**Atomicity boundary:**
- Parsing and validation: per-row
- Database insert: all valid rows are inserted in a single transaction. If the DB insert fails (rare), all valid rows roll back together — but this is not exposed as a row-level error (it surfaces as a 500)

---

### CSV-3a: Deduplication

**Duplicate key:** `(supplier_name, unit_price, currency)` — the same supplier can appear in an RFQ with a different price (e.g. a revised quote) and it is treated as a distinct quote. Only an exact match on all three fields is a duplicate.

**Within-file deduplication:** If the same `(supplier_name, unit_price, currency)` combination appears more than once in the uploaded CSV, the first occurrence is kept and subsequent occurrences are silently skipped (not counted as errors or successes).

**Against existing DB rows:** Before inserting, the server checks existing quotes for this RFQ. Any CSV row whose `(supplier_name, unit_price, currency)` already exists in the database is rejected with a row-level error:

> `"a quote from '{supplier_name}' with price {unit_price} {currency} already exists for this RFQ"`

This allows re-importing a corrected file without creating duplicates, while still allowing the same supplier to appear at a different price.

---

### CSV-4: Sample CSV Download

**Trigger:** User clicks "Download sample CSV" link inside the modal.

**Behavior:** Browser downloads a file named `sample_quotes.csv` with the following content (generated as a Blob URL client-side):

```csv
supplier_name,unit_price,currency,lead_time_days,payment_terms,remarks
Acme Metals,12.75,USD,14,Net 30,Includes shipping
Global Steel,11.50,USD,21,Net 45,FOB origin
Pacific Supplies,13.20,USD,7,COD,Express delivery available
```

This same file is included in the repository root as `sample_quotes.csv`.

---

## CSV Format Specification

### Column Headers

Headers are **case-insensitive**. The following aliases are accepted:

| Canonical Name | Accepted Aliases |
|---|---|
| `supplier_name` | `supplier`, `vendor`, `vendor_name`, `company` |
| `unit_price` | `price`, `unit_cost`, `cost` |
| `currency` | `currency_code`, `curr` |
| `lead_time_days` | `lead_time`, `lead_days`, `days` |
| `payment_terms` | `terms`, `payment` |
| `remarks` | `notes`, `comment`, `comments` |

Column order is flexible. Extra unrecognized columns are silently ignored.

### Row-Level Validation

| Field | Required | Type | Rules | Error |
|---|---|---|---|---|
| `supplier_name` | Yes | string | Non-empty; max 255 chars | "supplier_name is required" |
| `unit_price` | Yes | decimal | Parseable as number; >= 0 | "unit_price must be a non-negative number" |
| `currency` | No | string | 3 letters if provided | "currency must be a 3-letter ISO code (e.g., USD, EUR)" |
| `lead_time_days` | No | integer | Non-negative whole number if provided | "lead_time_days must be a non-negative integer" |
| `payment_terms` | No | string | Max 255 chars | "payment_terms exceeds 255 characters" |
| `remarks` | No | string | No limit | – |

**Blank optional fields** are treated as `null` — not an error.

**Blank rows** (all cells empty) are silently skipped.

**currency** is coerced to uppercase before validation (`usd` → `USD`). If the cell is blank, `USD` is used as the default.

---

## API Contract

### `POST /api/rfq/{rfq_id}/quotes/import`

**Request:** `multipart/form-data`, field name: `file`

**Response (always HTTP 200 for row-level outcomes):**

```json
{
  "imported": 3,
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
      "supplier_name": "Acme Metals",
      "unit_price": 12.75,
      "currency": "USD",
      "total_price": 6375.00,
      "is_best_quote": false,
      "source": "csv",
      ...
    }
  ]
}
```

**Response (HTTP 400 for file-level errors):**

```json
{ "detail": "File exceeds 5 MB limit" }
```

Full spec: `product-docs/03-api-spec.md` and `product-docs/04-csv-format.md`.

---

## Acceptance Criteria

- [ ] User can upload `sample_quotes.csv` (from the repo root) and all 3 rows import successfully
- [ ] The imported quotes appear immediately in the comparison table after the modal is closed
- [ ] `source` field on imported quotes is `"csv"` (visible in the Source column as a blue "CSV" badge)
- [ ] A CSV with one bad row and two good rows imports the two good rows and reports one error
- [ ] A CSV with all bad rows imports 0 rows and reports all errors
- [ ] Row numbers in the error table match the data row position (1-indexed, not counting the header)
- [ ] A row where every cell is blank is silently skipped (not counted as an error or a success)
- [ ] A CSV missing the `supplier_name` column returns a 400 with a clear message
- [ ] A file larger than 5 MB returns a 400 with a clear message
- [ ] `currency` values are coerced to uppercase (`usd` → `USD`)
- [ ] After a successful import, the file input resets so a second import can be done immediately
- [ ] "Download sample CSV" produces a downloadable file with the correct 3-row sample content
- [ ] If quotes with mixed currencies are imported (e.g., USD + EUR), the currency warning banner appears above the comparison table
- [ ] Uploading the same CSV twice imports all rows the first time; the second upload reports every row as a duplicate error and imports 0
- [ ] A CSV with two identical rows (same supplier_name, unit_price, currency) imports only one of them silently — no error for the duplicate row
- [ ] A supplier that appears twice in the CSV with different prices is imported as two distinct quotes (not a duplicate)

---

## Out of Scope

- Drag-and-drop file upload
- Excel (`.xlsx`) or other format support
- User-configurable column mapping
- Previewing rows before committing the import
- Async/background import for large files
