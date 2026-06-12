# Feature Spec 01 — RFQ Management

## Overview

A procurement user can create, view, list, edit, void, and delete Requests for Quotation (RFQs). An RFQ is the root entity — all supplier quotes belong to an RFQ. RFQs follow a status lifecycle: `open` → `awarded` → `void`.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| RFQ-1 | procurement user | create a new RFQ with item details | I can start collecting supplier quotes |
| RFQ-2 | procurement user | see a list of all my RFQs with their status | I can navigate to any active request |
| RFQ-3 | procurement user | view the full details of an RFQ | I can review what was requested before comparing quotes |
| RFQ-4 | procurement user | edit an open RFQ | I can correct mistakes before awarding |
| RFQ-5 | procurement user | void an RFQ | I can close it as rejected or cancelled |
| RFQ-6 | procurement user | search RFQs by name | I can find a specific RFQ quickly |
| RFQ-7 | procurement user | delete an RFQ I no longer need | I can keep the list clean |

---

## Data

| Field | Type | Required | Constraints |
|---|---|---|---|
| `item_name` | string | Yes | Non-empty, max 255 chars |
| `material_spec` | string | No | Free text |
| `quantity` | decimal | Yes | > 0 |
| `delivery_expectation` | date | No | ISO `YYYY-MM-DD` |
| `notes` | string | No | Free text |
| `status` | string | System | `open` \| `awarded` \| `void`; default `open` |
| `awarded_quote_id` | UUID | System | FK to the awarded quote; null unless status is `awarded` |

System-managed: `id` (UUID), `created_at`, `updated_at`, `quote_count` (computed).

---

## Status Lifecycle

```
open ──► awarded ──► void
  └──────────────────►
```

- `open` — initial state; RFQ and quotes are fully editable
- `awarded` — set via `/award` endpoint; RFQ and quotes become read-only; only allowed transition is to `void`
- `void` — terminal state; nothing can be modified

Status changes only via dedicated endpoints (`/award`, `/void`). `PUT /api/rfq/:id` does not accept a status field.

---

## Functional Requirements

### RFQ-1: Create RFQ

**Trigger:** "New RFQ" button on the list page opens a modal.

**Validation:** `item_name` required; `quantity` required and > 0; all others optional.

**Success:** Modal closes; user navigates to the new RFQ's detail page. Status is `open`.

---

### RFQ-2: List RFQs

**Display:** Table — Item Name | Status | Quantity | Delivery By | Quotes | Created | Actions

**Status badge:** Colour-coded chip per row.

**Search:** Input above table, debounced 300ms. Filters by `item_name` (case-insensitive). Resets to page 1 on change. Empty state message changes when search yields no results.

**Pagination:** 20 rows/page, offset-based, sticky at bottom of scroll container.

---

### RFQ-3: View RFQ

**RFQ metadata strip** — horizontal, always fully expanded. Fields as columns (label above value): Quantity | Delivery By | Material Spec | Notes | Created. Item name is the page heading, not repeated in the strip. Long fields flex to fill available width; overflow truncated with a tooltip.

**Status indicator** in the page header alongside the item name.

---

### RFQ-4: Edit RFQ

**Trigger:** "Edit RFQ" button — only rendered when `status === 'open'`.

**Modal:** Pre-populated with current values. Fields: item_name, material_spec, quantity, delivery_expectation, notes. No status field — use `/void` to change status.

**Blocked states:** Button hidden for `awarded` and `void` RFQs. Backend also enforces (409) as a safety net.

---

### RFQ-5: Void RFQ

**Trigger:** "Void RFQ" button — rendered when `status !== 'void'`.

**Confirmation:** `ConfirmModal` with contextual message:
- From `open`: "Void [name]? This will close the RFQ as rejected."
- From `awarded`: "Void [name]? This will reject the awarded decision."

**Result:** Status becomes `void`. All lock notices update. Void is irreversible.

---

### RFQ-6: Search RFQs

**Trigger:** Typing in the search input above the RFQ list.

**Behaviour:** Debounced 300ms. Sends `?search=` query param. `total` in the response reflects the filtered count.

---

### RFQ-7: Delete RFQ

**Trigger:** "Delete" button on the list row → `ConfirmModal`.

**Result:** RFQ and all associated quotes are deleted. Row removed without full page reload.

---

## API Contracts

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rfq` | Create RFQ |
| `GET` | `/api/rfq?limit&offset&search` | List RFQs |
| `GET` | `/api/rfq/{rfq_id}` | Get single RFQ |
| `PUT` | `/api/rfq/{rfq_id}` | Edit RFQ (open only) |
| `POST` | `/api/rfq/{rfq_id}/award` | Award RFQ |
| `POST` | `/api/rfq/{rfq_id}/void` | Void RFQ |
| `DELETE` | `/api/rfq/{rfq_id}` | Delete RFQ |

Full shapes: `product-docs/03-api-spec.md`.

---

## Acceptance Criteria

- [ ] Create form submits with only `item_name` and `quantity`; all other fields optional
- [ ] Empty `item_name` or `quantity ≤ 0` shows validation error and does not call API
- [ ] New RFQ appears at top of list with `status: open` badge
- [ ] Editing an open RFQ updates values without changing status
- [ ] "Edit RFQ" button is absent when status is `awarded` or `void`
- [ ] Voiding from `open` → status badge shows "Void"; button disappears
- [ ] Voiding from `awarded` → status changes from "Awarded" to "Void"
- [ ] Search filters the list live; clearing search restores full list
- [ ] Delete shows ConfirmModal (no `window.confirm`)
- [ ] Deleting an RFQ removes all its quotes (no orphaned data)
- [ ] `quote_count` reflects current number of quotes (not stale)
