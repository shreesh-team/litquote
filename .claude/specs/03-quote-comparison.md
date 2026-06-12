# Feature Spec 03 — Quote Comparison

## Overview

The quote comparison table is the core value-delivery feature of litquote. It gives procurement users a clear view of all supplier quotes for an RFQ, automatically identifies the best offer, flags delivery risk, shows an insight banner summarising the key decision, and records the final award.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| CMP-1 | procurement user | see all quotes side by side in a table | I can compare them at a glance |
| CMP-2 | procurement user | have the cheapest quote automatically highlighted | I don't have to scan and calculate manually |
| CMP-3 | procurement user | see the computed total price for each quote | I don't have to multiply unit price × quantity myself |
| CMP-4 | procurement user | be warned when quotes use different currencies | I know when the comparison is not apples-to-apples |
| CMP-5 | procurement user | see a delivery risk flag | I know which quotes may arrive too late |
| CMP-6 | procurement user | see an insight banner above the table | I get the key recommendation without reading every row |

---

## Functional Requirements

### CMP-1: Quote Comparison Table

**Location:** Supplier Quotes section on `/rfq/:id`, below the metadata strip.

**Data source:** `GET /api/rfq/{rfq_id}/quotes` — fetched on load and after every mutation.

**Columns:**

| Column | Field | Notes |
|---|---|---|
| Supplier | `supplier_name` | "Awarded" badge when `is_awarded`; "Best Price" badge when `is_best_quote` and not awarded |
| Unit Price | `unit_price` | 2 decimal places |
| Currency | `currency` | 3-letter code |
| Total Price | `total_price` | Bold; green if best; gold if awarded |
| Lead Time | `lead_time_days` | "14 days"; "—" if null; "Late delivery risk" badge if `delivery_risk` |
| Payment Terms | `payment_terms` | "—" if null |
| Remarks | `remarks` | "—" if null |
| Source | `source` | Pill badge: "Manual" or "CSV" |
| Actions | — | Award / Edit / Delete buttons (hidden when RFQ is locked) |

**Sort:** `total_price` ASC server-side; ties broken by `lead_time_days` ASC (null last).

**Pagination:** Client-side, 10 rows/page. Prev / Next + "Page X of Y (N quotes)" shown only when > 10 quotes.

**Empty state:** "No quotes yet. Add a quote manually or import from CSV to start comparing."

---

### CMP-2: Best Quote Highlighting

The best quote is the one with the lowest `total_price`. Ties: all tied quotes are highlighted.

**Row class:** `.row--best` (when `is_best_quote && !is_awarded`)

**Awarded row class:** `.row--awarded` (when `is_awarded`; takes visual priority)

The frontend applies styles based on `quote.is_best_quote` and `quote.is_awarded` — it never computes comparisons itself.

---

### CMP-3: Total Price

`total_price = unit_price × rfq.quantity` — computed server-side, never stored. Displayed to 2 decimal places.

---

### CMP-4: Currency Warning

When `summary.currency_warning === true` (quotes span ≥ 2 distinct currencies), a warning banner renders above the table:

```
⚠ Quotes use mixed currencies. Total price comparison may not be meaningful.
```

Table still renders; best-quote highlight still appears.

---

### CMP-5: Delivery Risk

`delivery_risk = today + lead_time_days > rfq.delivery_expectation`

- `false` if either `lead_time_days` or `delivery_expectation` is null
- Shown as a "Late delivery risk" badge on the lead time cell
- Also surfaced in the InsightBanner

---

### CMP-6: Insight Banner

Rendered above the table whenever quotes exist (not shown when quote list is empty).

**Awarded state:**
```
✓ Awarded to [Supplier] — [Currency] [Total] · ⚠ Delivery risk   (if applicable)
```

**Open state (best quote exists):**
```
★ Best option: [Supplier] at [Currency] [Total] · saves [Currency] [Amount] vs. next best · ⚠ Delivery risk / · Delivers on time
```

- "saves X vs. next best" only shown when there are ≥ 2 quotes and best is not tied
- Delivery qualifier omitted when `delivery_expectation` is null

---

## Backend Logic (`services/comparison.py`)

Signature:
```python
def enrich_quotes(
    quotes: list[dict],
    rfq_quantity: Decimal,
    delivery_expectation: date | None = None,
    awarded_quote_id: str | None = None,
) -> tuple[list[dict], str | None]:
```

Steps:
1. Compute `total_price = unit_price × rfq_quantity` for each quote
2. Find `min_total = min(total_prices)`
3. Set `is_best_quote = True` for all quotes where `total_price == min_total`
4. Set `is_awarded = (quote["id"] == awarded_quote_id)` when `awarded_quote_id` is set
5. Set `delivery_risk = today + timedelta(lead_time_days) > delivery_expectation` where both are present
6. Sort by `total_price` ASC, then `lead_time_days` ASC (null last)
7. Return `(enriched_quotes, best_quote_id)`

**UUID gotcha:** psycopg2 without `register_uuid()` returns UUID columns as plain strings. FastAPI path params parse to Python `UUID` objects. Always compare as `str(q["id"]) == str(quote_id)` to avoid false mismatches.

**StopIteration gotcha:** `next(genexp)` raises `StopIteration` which propagates as `RuntimeError` in FastAPI's anyio threadpool. Always use `next((genexp), None)` with an explicit None check.

---

## Acceptance Criteria

- [ ] All quotes sorted cheapest first; ties broken by lead time
- [ ] `total_price` equals `unit_price × rfq.quantity` (spot-check)
- [ ] Lowest-total row has green highlight and "Best Price" badge
- [ ] Two quotes with equal totals both get the best-quote highlight
- [ ] Adding/deleting/editing a quote updates the highlight without page reload
- [ ] Currency warning banner shown when quotes span ≥ 2 currencies; absent otherwise
- [ ] "Late delivery risk" badge shown on correct rows; absent when no delivery date set
- [ ] InsightBanner shows awarded supplier after awarding; best option otherwise
- [ ] "saves X vs. next best" shown only when best is unique and there are ≥ 2 quotes
- [ ] All action buttons hidden when `rfq.status !== 'open'`
- [ ] Empty state shown when no quotes; no JS errors

---

## Out of Scope

- User-controlled column sorting
- Export to PDF / Excel
- Currency conversion
- Weighted scoring (lead time vs price vs terms)
- Historical comparison across RFQs
