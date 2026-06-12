# Feature Spec 02 — Supplier Quote Management

## Overview

A procurement user can add, edit, delete, and award supplier quotes on an open RFQ. Once an RFQ is awarded or voided, all quote mutations are blocked. Each quote represents one supplier's offer for the items described in the RFQ.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| QUOTE-1 | procurement user | add a supplier quote to an RFQ | I can record each supplier's offer |
| QUOTE-2 | procurement user | see all quotes for an RFQ in one place | I can compare them |
| QUOTE-3 | procurement user | edit a quote I entered incorrectly | I can correct mistakes without deleting and re-adding |
| QUOTE-4 | procurement user | award a quote | I can record my procurement decision |
| QUOTE-5 | procurement user | delete a quote I added by mistake | I can keep the comparison clean |

---

## Data

| Field | Type | Required | Constraints |
|---|---|---|---|
| `supplier_name` | string | Yes | Non-empty, max 255 chars |
| `unit_price` | decimal | Yes | >= 0 |
| `currency` | string | No (default: `USD`) | Exactly 3 uppercase letters (ISO 4217) |
| `lead_time_days` | integer | No | >= 0 |
| `payment_terms` | string | No | Max 255 chars |
| `remarks` | string | No | Free text |

System-managed: `id` (UUID), `rfq_id` (FK), `source` (`"manual"` or `"csv"`), `created_at`.

Computed (never stored): `total_price`, `is_best_quote`, `is_awarded`, `delivery_risk`.

---

## Computed Fields

| Field | Formula |
|---|---|
| `total_price` | `unit_price × rfq.quantity` |
| `is_best_quote` | `true` for all quotes tied at the minimum `total_price` within the RFQ |
| `is_awarded` | `true` when this quote's `id === rfq.awarded_quote_id` |
| `delivery_risk` | `true` when `today + lead_time_days > rfq.delivery_expectation`; `false` if either is null |

---

## Locking Rules

When `rfq.status` is `awarded` or `void`, all of the following are blocked (returns 409):
- Adding a quote
- Editing a quote
- Deleting a quote
- Importing CSV quotes

The "Award", "Edit", and "Delete" buttons in the UI are hidden when `rfq.status !== 'open'`. The backend enforces the same constraint as a safety net.

---

## Functional Requirements

### QUOTE-1: Add a Quote

**Trigger:** "+ Add Quote" button in the Supplier Quotes section header (hidden when RFQ is locked).

**Modal:** 660px wide overlay. Closes on success. Escape and backdrop click also close it.

**Validation:** `supplier_name` required; `unit_price` required >= 0; `currency` 3 letters if provided (auto-uppercased).

**Success:** Table refreshes; `is_best_quote` recalculates across all quotes.

---

### QUOTE-2: View Quotes

See Feature Spec 03 — Quote Comparison for the full table spec.

---

### QUOTE-3: Edit a Quote

**Trigger:** "Edit" button per row (hidden when RFQ is locked).

**Modal:** Pre-populated with existing quote values. All fields editable. Uses `AddQuoteForm` with `initialValues`.

**Success:** Table refreshes in-place; `is_best_quote` recalculates.

---

### QUOTE-4: Award a Quote

**Trigger:** "Award" button per row (hidden when RFQ is locked).

**Confirmation:** `ConfirmModal` — "Award this RFQ to [Supplier] at [Currency] [Total]?" (non-danger confirm).

**Result:**
- `POST /api/rfq/:id/award` with `{ quote_id }`
- RFQ status → `awarded`; `awarded_quote_id` set
- Awarded row gets "Awarded" badge and gold row highlight
- All Award / Edit / Delete buttons disappear (RFQ is now locked)
- InsightBanner updates to awarded state

---

### QUOTE-5: Delete a Quote

**Trigger:** "Delete" button per row (hidden when RFQ is locked).

**Confirmation:** `ConfirmModal` (danger) — "Delete the quote from [Supplier]? This cannot be undone."

**Success:** Row removed; `is_best_quote` recalculates; `quote_count` decrements.

---

## API Contracts

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rfq/{rfq_id}/quotes` | Add quote (blocked if locked) |
| `GET` | `/api/rfq/{rfq_id}/quotes` | List & compare quotes |
| `PUT` | `/api/quote/{quote_id}` | Edit quote (blocked if locked) |
| `POST` | `/api/rfq/{rfq_id}/award` | Award RFQ to a quote |
| `DELETE` | `/api/quote/{quote_id}` | Delete quote (blocked if locked) |

Full shapes: `product-docs/03-api-spec.md`.

---

## Business Rules

1. `total_price` is always computed, never stored — consistent with `rfq.quantity` at query time.
2. `unit_price = 0` is valid (free samples); results in `total_price = 0` and would be best quote.
3. `source` is set automatically: `"manual"` for form-entered, `"csv"` for imported.
4. No deduplication on `supplier_name` — the same supplier may be entered twice intentionally.
5. Sorting: quotes returned cheapest first; ties broken by `lead_time_days` ASC (null sorts last).

---

## Acceptance Criteria

- [ ] Adding a quote with only `supplier_name` and `unit_price` succeeds
- [ ] `unit_price = 0` accepted; `unit_price = -1` rejected
- [ ] `currency = "US"` rejected; `"usd"` auto-uppercased to `"USD"`
- [ ] After adding, table updates without page reload
- [ ] Editing a quote pre-populates the modal with existing values
- [ ] After editing, updated values appear in the table; best-quote recalculates
- [ ] Award button shows ConfirmModal; after confirming: RFQ status → "Awarded"; awarded row highlighted; all action buttons hidden
- [ ] Delete shows ConfirmModal (no `window.confirm`); after confirming: row removed; best-quote recalculates
- [ ] All action buttons absent when `rfq.status !== 'open'`
- [ ] API returns 409 (not 500) when attempting any mutation on a locked RFQ
