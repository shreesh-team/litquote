# Feature Spec 03 — Quote Comparison

## Overview

The quote comparison table is the core value-delivery feature of litquote. It gives procurement users a single, clear view of all supplier quotes for an RFQ, automatically identifies the best (lowest total price) offer, and warns when cross-currency comparisons may be unreliable.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| CMP-1 | procurement user | see all quotes for an RFQ side by side in a table | I can compare them at a glance |
| CMP-2 | procurement user | have the cheapest quote automatically highlighted | I don't have to manually scan and calculate |
| CMP-3 | procurement user | see the computed total price for each quote | I don't have to multiply unit price × quantity myself |
| CMP-4 | procurement user | be warned when quotes use different currencies | I know when the comparison is not apples-to-apples |

---

## Functional Requirements

### CMP-1: Quote Comparison Table

**Location:** Second section on the RFQ detail page (`/rfq/:id`), below the RFQ summary card.

**Data source:** `GET /api/rfq/{rfq_id}/quotes` — fetched on page load and after every add/delete/import action.

**Columns (in order):**

| Column | Field | Notes |
|---|---|---|
| Supplier | `supplier_name` | May include a "Best Price" badge |
| Unit Price | `unit_price` | Formatted with two decimal places |
| Currency | `currency` | Three-letter code (e.g., USD) |
| Total Price | `total_price` | Bold; green if best quote |
| Lead Time | `lead_time_days` | Displayed as "14 days"; blank if null |
| Payment Terms | `payment_terms` | Blank if null |
| Remarks | `remarks` | Truncated at 80 chars with ellipsis if longer |
| Source | `source` | Pill badge: "Manual" (grey) or "CSV" (blue) |
| Actions | — | Delete button per row |

**Default sort:** `total_price` ascending (cheapest first). Sort is applied server-side; the API always returns quotes sorted this way.

**Empty state:** When an RFQ has no quotes, display:
```
No quotes yet. Add a quote below or import from CSV.
```

**Loading state:** Spinner or skeleton rows while fetching.

**Responsive behavior:** On viewports narrower than 768px, the table scrolls horizontally. No columns are hidden.

---

### CMP-2: Best Quote Highlighting

**Definition:** The best quote is the one with the lowest `total_price`. If multiple quotes tie at the same lowest total, all tied quotes are highlighted.

**Visual treatment for the best-quote row:**

| Element | Style |
|---|---|
| Row background | `#f0fdf4` (light green) |
| Left border | `4px solid #22c55e` (green) |
| Total Price cell | Bold weight + `#15803d` (dark green) text |
| Supplier cell | Appended "Best Price" pill badge (green) |

The `is_best_quote` boolean and `best_quote_id` are computed and returned by the API — the frontend does not implement any comparison logic. It applies styles only to rows where `quote.is_best_quote === true`.

**Dynamic recalculation:** Every time a quote is added, deleted, or imported, the frontend re-fetches the quote list. The best-quote highlight always reflects the current state of all quotes.

---

### CMP-3: Total Price Computation

**Formula:** `total_price = unit_price × rfq.quantity`

This is computed in the backend service layer (`services/comparison.py`) and returned as a field on every quote object. The frontend never performs this multiplication — it only displays the value.

**Precision:** `total_price` is returned as a decimal with up to 4 decimal places. Display it formatted to 2 decimal places in the UI.

---

### CMP-4: Currency Warning

**Trigger:** Displayed when `summary.currency_warning === true` in the API response. This flag is `true` when quotes on the same RFQ have at least two distinct currency values.

**Display:** A warning banner above the comparison table:

```
⚠ Quotes use mixed currencies. Total price comparison may not be meaningful.
```

**Style:** Yellow background (`#fffbeb`), amber border (`#f59e0b`), amber text.

**Behavior:** The comparison table still renders normally — the warning is informational only. The best-quote highlight still appears (the system compares raw numeric values; the user is responsible for interpreting the result).

---

## Data Contract

The comparison endpoint returns a single enriched response:

```json
{
  "rfq": { "id": "...", "item_name": "...", "quantity": 500, ... },
  "quotes": [
    {
      "id": "...",
      "supplier_name": "Global Steel",
      "unit_price": 11.50,
      "currency": "USD",
      "lead_time_days": 21,
      "payment_terms": "Net 45",
      "remarks": "FOB origin",
      "source": "manual",
      "total_price": 5750.00,
      "is_best_quote": true,
      "created_at": "..."
    }
  ],
  "best_quote_id": "...",
  "summary": {
    "quote_count": 3,
    "lowest_total": 5750.00,
    "highest_total": 6600.00,
    "currency_warning": false
  }
}
```

Full spec: `product-docs/03-api-spec.md`.

---

## Backend Logic (`services/comparison.py`)

The comparison service is a pure function with no database access:

**Input:** list of raw quote dicts + `rfq_quantity: Decimal`

**Steps:**
1. Compute `total_price = unit_price × rfq_quantity` for each quote
2. Find `min_total = min(total_prices)`
3. Set `is_best_quote = True` for all quotes where `total_price == min_total` (handles ties)
4. Sort quotes by `total_price` ASC
5. Set `best_quote_id` to the `id` of the first quote with `is_best_quote = True`
6. Set `currency_warning = len(set(currencies)) > 1`

**Edge cases:**
- Empty list → return `([], None, False)`
- Single quote → it is always the best quote
- All quotes with the same total → all are highlighted; `best_quote_id` = first (lowest `created_at`)
- `unit_price = 0` → `total_price = 0`; this is a valid (and likely best) quote

---

## Acceptance Criteria

- [ ] All quotes for an RFQ appear in the table sorted cheapest first
- [ ] `total_price` displayed equals `unit_price × rfq.quantity` (spot-check manually)
- [ ] The row with the lowest total price has the green highlight and "Best Price" badge
- [ ] When two quotes have identical total prices, both are highlighted as best
- [ ] Adding or deleting a quote updates the best-quote highlight without a page reload
- [ ] When all quotes use the same currency, the currency warning banner is absent
- [ ] When quotes use two or more different currencies, the currency warning banner appears above the table
- [ ] The table renders without errors when there are zero quotes (empty state message shown)
- [ ] The table renders without errors when there is exactly one quote (it is the best)
- [ ] On a viewport < 768px wide, the table scrolls horizontally and no data is clipped

---

## Out of Scope

- User-controlled sorting (clicking column headers to sort)
- Saving or exporting the comparison as PDF or Excel
- Currency conversion (showing quotes in a common currency)
- Weighted scoring (e.g., scoring lead time vs price vs payment terms)
- Historical comparison across multiple RFQs
