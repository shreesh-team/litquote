# Feature Spec 02 — Supplier Quote Management

## Overview

A procurement user can add supplier quotes to an existing RFQ and delete quotes they no longer need. Each quote represents one supplier's offer for the items described in the RFQ. The system computes the total price automatically.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| QUOTE-1 | procurement user | add a supplier quote to an RFQ | I can record each supplier's offer |
| QUOTE-2 | procurement user | see all quotes for an RFQ in one place | I can compare them |
| QUOTE-3 | procurement user | delete a quote I added by mistake | I can keep the comparison clean |

---

## Data

A supplier quote has the following fields:

| Field | Type | Required | Constraints |
|---|---|---|---|
| `supplier_name` | string | Yes | Non-empty, max 255 chars |
| `unit_price` | decimal | Yes | >= 0 (allows $0 for free samples) |
| `currency` | string | No (default: `USD`) | Exactly 3 uppercase letters (ISO 4217) |
| `lead_time_days` | integer | No | >= 0 |
| `payment_terms` | string | No | Max 255 chars |
| `remarks` | string | No | Free text, any length |

System-managed fields: `id` (UUID), `rfq_id` (FK), `source` (`"manual"` or `"csv"`), `created_at`.

Computed fields (never stored): `total_price`, `is_best_quote`.

---

## Functional Requirements

### QUOTE-1: Add a Quote

**Trigger:** User clicks "+ Add Quote" button in the Supplier Quotes section header on `/rfq/:id`.

**Location:** The form opens in a modal overlay (660px wide). On success the modal closes; the table refreshes without a page reload. Does not navigate away.

**Inputs:** supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks.

**Validation (client-side, on blur and on submit):**
- `supplier_name`: required, non-empty
- `unit_price`: required, must parse as a number >= 0
- `currency`: if provided, must be exactly 3 alphabetic characters (auto-uppercased)
- `lead_time_days`: if provided, must be a non-negative whole number

**Validation (server-side):**
- Same rules as above; returns 422 with field-level errors if violated
- Returns 404 if the `rfq_id` does not exist

**Success behavior:**
- The form resets to its default state (currency resets to "USD")
- The comparison table updates to include the new quote
- The new quote is visible immediately — no full page reload required
- `is_best_quote` is recalculated across all quotes

**Error behavior:**
- Inline field errors for validation failures (422)
- Toast or inline banner for unexpected errors (500)
- Submit button is disabled while the request is in flight (prevents double submission)

---

### QUOTE-2: View Quotes

Quotes are displayed in the comparison table on the RFQ detail page. See Feature Spec 03 — Quote Comparison for the full table specification.

All quotes for an RFQ are fetched together via `GET /api/rfq/{rfq_id}/quotes`, which returns the quotes alongside the RFQ and summary statistics.

The table is **paginated client-side at 10 rows per page**. Pagination controls (Prev / Next + "Page X of Y") appear only when there are more than 10 quotes. The best-quote row is marked with a ★ prefix and an accent background regardless of which page it lands on.

---

### QUOTE-3: Delete a Quote

**Trigger:** User clicks "Delete" (or a trash icon) on a quote row in the comparison table.

**No confirmation dialog required** — quote deletion is low-stakes (re-adding is trivial).

**Success behavior:**
- The row disappears from the table
- `is_best_quote` is recalculated — the best-quote highlight may move to a different row
- The RFQ's `quote_count` decrements

**Error behavior:**
- If the quote is not found (404), show an inline error and refresh the table

---

## API Contracts

| Method | Path | Request | Success Response |
|---|---|---|---|
| `POST` | `/api/rfq/{rfq_id}/quotes` | Quote fields as JSON body | 201 with enriched quote (includes `total_price`, `is_best_quote`) |
| `GET` | `/api/rfq/{rfq_id}/quotes` | — | 200 with `{ rfq, quotes[], best_quote_id, summary }` |
| `DELETE` | `/api/quote/{quote_id}` | — | 204 No Content; 404 if not found |

Full request/response shapes: see `product-docs/03-api-spec.md`.

---

## Business Rules

1. **`total_price` is always computed, never stored:** `total_price = unit_price × rfq.quantity`. This ensures the total is always consistent with the RFQ's quantity, even if the quantity were to change.

2. **`unit_price = 0` is valid.** Some suppliers offer samples at no cost. A zero price results in `total_price = 0` and would be the best quote.

3. **The `source` field is set automatically:** Quotes added via this form always have `source = "manual"`. Quotes imported via CSV have `source = "csv"`. The user does not set this field.

4. **No deduplication:** A procurement user may intentionally enter the same supplier twice (e.g., to compare two different configurations). The system does not enforce uniqueness on `supplier_name` within an RFQ.

---

## Acceptance Criteria

- [x] User can add a quote with only `supplier_name` and `unit_price`; other fields are optional
- [x] `unit_price = 0` is accepted and creates a valid quote with `total_price = 0`
- [x] `unit_price = -1` is rejected with a validation error
- [x] `currency = "US"` (2 chars) is rejected; `currency = "USD"` is accepted
- [x] `currency` input is coerced to uppercase before submission ("usd" → "USD")
- [x] After adding a quote, the comparison table updates without a page reload
- [x] Deleting a quote removes it from the table and recalculates best-quote highlighting
- [x] The submit button is disabled while the POST request is pending
- [x] Adding a quote to a non-existent RFQ returns 404 (not a 500)

---

## Out of Scope

- Editing an existing quote
- Quote versioning or history
- Supplier address book / supplier master data
- Currency conversion
