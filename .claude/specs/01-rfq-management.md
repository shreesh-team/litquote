# Feature Spec 01 — RFQ Management

## Overview

A procurement user can create, view, list, and delete Requests for Quotation (RFQs). An RFQ is the root entity in the system — all supplier quotes belong to an RFQ.

## User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| RFQ-1 | procurement user | create a new RFQ with item details | I can start collecting supplier quotes |
| RFQ-2 | procurement user | see a list of all my RFQs | I can navigate to any active request |
| RFQ-3 | procurement user | view the full details of an RFQ | I can review what was requested before comparing quotes |
| RFQ-4 | procurement user | delete an RFQ I no longer need | I can keep the list clean |

---

## Data

An RFQ has the following fields:

| Field | Type | Required | Constraints |
|---|---|---|---|
| `item_name` | string | Yes | Non-empty, max 255 chars |
| `material_spec` | string | No | Free text, any length |
| `quantity` | decimal | Yes | Must be > 0 |
| `delivery_expectation` | date | No | ISO format `YYYY-MM-DD` |
| `notes` | string | No | Free text, any length |

System-managed fields: `id` (UUID), `created_at`, `updated_at`, `quote_count` (computed).

---

## Functional Requirements

### RFQ-1: Create RFQ

**Trigger:** User clicks "Create New RFQ" from the list page and submits the form.

**Inputs:** item_name, material_spec, quantity, delivery_expectation, notes.

**Validation (client-side, on blur and on submit):**
- `item_name`: required, non-empty
- `quantity`: required, must parse as a positive number (> 0)
- All other fields: optional

**Validation (server-side, always):**
- Same rules as above; server returns HTTP 422 with field-level errors if violated

**Success behavior:**
- RFQ is persisted to the database
- User is navigated to the RFQ detail page (`/rfq/{id}`)
- The new RFQ shows `quote_count: 0`

**Error behavior:**
- Client-side errors: displayed inline beneath the offending input before the form is submitted
- Server-side 422: field errors are mapped back to the corresponding input fields
- Server-side 500: a generic "Something went wrong" message is shown

---

### RFQ-2: List RFQs

**Trigger:** User navigates to `/rfq`.

**Display:** A table with columns — Item Name | Quantity | Delivery Expectation | Quote Count | Created | Actions.

**Ordering:** Newest first (`created_at DESC`).

**Pagination:** 20 items per page; offset-based. Show total count.

**Empty state:** "No RFQs yet. Create your first one." with a call-to-action button.

**Loading state:** A spinner or skeleton rows while the fetch is in progress.

**Actions per row:**
- "View" — navigates to `/rfq/{id}`
- "Delete" — see RFQ-4

---

### RFQ-3: View RFQ

**Trigger:** User clicks "View" from the list or is navigated there after creating an RFQ.

**Display:** A read-only summary card showing all RFQ fields. Below it, the quote comparison table and add-quote form (see Feature Spec 02 and 03).

**No edit functionality** — editing an RFQ is out of scope for this version.

---

### RFQ-4: Delete RFQ

**Trigger:** User clicks "Delete" on a row in the RFQ list.

**Confirmation:** A browser `confirm()` dialog (or inline confirmation UI) before issuing the delete request. Deletes cascade to all associated supplier quotes.

**Success behavior:** Row is removed from the list without a full page reload.

**Error behavior:** If the RFQ is not found (404), show an inline error and refresh the list.

---

## API Contracts

| Method | Path | Request | Success Response |
|---|---|---|---|
| `POST` | `/api/rfq` | RFQ fields as JSON body | 201 with full RFQ object |
| `GET` | `/api/rfq` | `?limit=20&offset=0` query params | 200 with `{ items, total, limit, offset }` |
| `GET` | `/api/rfq/{rfq_id}` | — | 200 with RFQ object; 404 if not found |
| `DELETE` | `/api/rfq/{rfq_id}` | — | 204 No Content; 404 if not found |

Full request/response shapes: see `product-docs/03-api-spec.md`.

---

## Acceptance Criteria

- [ ] User can submit the create form with only `item_name` and `quantity` filled; all other fields are optional
- [ ] Submitting with an empty `item_name` shows a validation error and does not call the API
- [ ] Submitting with `quantity = 0` or `quantity = -5` shows a validation error
- [ ] After creation, the RFQ list shows the new RFQ at the top
- [ ] `quote_count` on the list reflects the current number of quotes (not a stale cache)
- [ ] Deleting an RFQ also removes all its quotes (no orphaned data in the DB)
- [ ] Deleting an already-deleted RFQ (404) does not crash the UI

---

## Out of Scope

- Editing an existing RFQ
- RFQ status workflow (draft, open, closed)
- Attaching documents to an RFQ
- Multi-user ownership or assignment
