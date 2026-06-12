# Frontend Guide

## Routing Structure

Using React Router v7.

| Route | Component | Purpose |
|---|---|---|
| `/` | redirect | Redirects to `/rfq` |
| `/rfq` | `RFQListPage` | Browse all RFQs |
| `/rfq/:id` | `RFQDetailPage` | View RFQ, manage quotes, compare, import CSV |

Create RFQ is a modal on the list page — not a separate route. State is managed with `useState` + custom hooks per page. No global state library.

---

## Page Inventory

### `RFQListPage` — `/rfq`

**Data:** `GET /api/rfq` on mount and after mutations.

**Layout:**
- Page header: "Request for Quotations" + "+ New RFQ" button
- Search bar: text input debounced 300ms; passes `?search=` query param; resets offset to 0 on change
- RFQ table: Item Name | Status | Quantity | Delivery By | Quotes | Created | Actions
- Status column: badge showing `open` / `awarded` / `void`
- Actions per row: "View" link → `/rfq/:id`; "Delete" → opens `ConfirmModal`
- Empty state: different message when search has no results vs. no RFQs at all
- Sticky pagination: Previous / Next + "X–Y of N RFQs"

---

### `RFQDetailPage` — `/rfq/:id`

This is the core page. Layout top to bottom:

**Page header**
- Back link: "← RFQs"
- `<h1>` with item name
- `StatusBadge` (open / awarded / void)
- "Edit RFQ" button — visible only when `status === 'open'`
- "Void RFQ" button (danger) — visible when `status !== 'void'`; opens `ConfirmModal` with contextual message

**RFQ metadata strip** (`RFQSummaryCard`)

A compact horizontal strip of column-layout fields. No toggle, always fully visible. Fields: Quantity | Delivery By | Material Spec | Notes | Created. Item name is omitted (already the page `<h1>`). `material_spec` and `notes` columns flex to fill remaining space; long text is truncated with a CSS tooltip on hover (appears below, 280px wide).

**Supplier Quotes section**

- Section header: "Supplier Quotes" + "↑ Upload CSV" + "+ Add Quote" buttons (hidden when `status !== 'open'`)
- Lock notices:
  - Awarded: "🔒 This RFQ has been awarded and is locked. Void it to reject the decision."
  - Void: "🚫 This RFQ has been voided and is closed."
- `InsightBanner` (inline component, shown when quotes exist):
  - Awarded state: "✓ Awarded to [Supplier] — [Currency] [Total] · ⚠ Delivery risk (if applicable)"
  - Open state: "★ Best option: [Supplier] at [Currency] [Total] · saves [Amount] vs. next best · ⚠ Delivery risk / Delivers on time"
- `QuoteTable` — paginated comparison table

---

## Component Inventory

### `RFQSummaryCard`

Compact horizontal metadata strip. No state, no toggle. Each field rendered as a column (label above, value below). `material_spec` and `notes` have `flex: 1` so they absorb available width. Long values shown with `text-overflow: ellipsis` + a CSS `::after` tooltip (fixed 280px width, appears below on hover).

### `QuoteTable`

Props: `quotes`, `rfq`, `onDelete`, `onAward`, `onRefresh`, `currencyWarning`

- `isLocked = rfq?.status !== 'open'` — when true, Award / Edit / Delete buttons are all hidden
- Awarded quote row gets `.row--awarded` class (gold accent)
- `is_awarded` quote shows "Awarded" badge; `is_best_quote` shows "Best Price" badge (only when not awarded)
- Award button → `ConfirmModal` (non-danger) → calls `onAward(quoteId)`
- Edit button → `EditQuoteModal`
- Delete button → `ConfirmModal` (danger) → calls `onDelete(quoteId)`
- `delivery_risk` → "Late delivery risk" badge on lead time cell
- Currency warning banner above table when `currencyWarning === true`
- Client-side pagination at 10 rows/page

### `ConfirmModal`

Props: `message`, `onConfirm`, `onCancel`, `confirmLabel='Delete'`, `danger=true`

Reusable confirmation dialog. Uses `.modal-backdrop` / `.modal` chrome from `CreateRFQModal.css`. Replaces all `window.confirm` usage.

### `EditRFQModal`

Props: `rfq`, `onClose`, `onSuccess(updatedRfq)`

Pre-populated edit form for open RFQs. Fields: item_name, material_spec, quantity, delivery_expectation, notes. No status field — status is managed via dedicated endpoints only. Only accessible when `rfq.status === 'open'`.

### `EditQuoteModal`

Props: `quote`, `onClose`, `onSuccess()`

Wraps `AddQuoteForm` with `initialValues={quote}`. Uses `useEditQuote`.

### `AddQuoteForm`

Accepts `initialValues` prop (used by `EditQuoteModal` to pre-populate). Defaults to empty/USD when not provided.

### `CreateRFQModal`, `AddQuoteModal`, `CSVImportModal`

Modal overlays for create / add / bulk import flows. `AddQuoteModal` and `CSVImportModal` share `CreateRFQModal.css` for modal chrome.

---

## Component Tree

```
App
└── BrowserRouter
    └── Layout (sidebar nav + <Outlet />)
        ├── RFQListPage
        │   ├── search input (debounced)
        │   ├── RFQ table (with status badges)
        │   ├── CreateRFQModal (conditional)
        │   └── ConfirmModal (delete RFQ, conditional)
        └── RFQDetailPage
            ├── StatusBadge
            ├── EditRFQModal (conditional, open RFQs only)
            ├── ConfirmModal (void RFQ, conditional)
            ├── RFQSummaryCard (horizontal meta strip)
            ├── InsightBanner (conditional, when quotes exist)
            ├── QuoteTable (paginated)
            │   ├── currency warning banner (conditional)
            │   ├── table rows with Award / Edit / Delete actions
            │   ├── ConfirmModal (delete / award quote, conditional)
            │   ├── EditQuoteModal (conditional)
            │   └── empty state (if no quotes)
            ├── AddQuoteModal (conditional)
            └── CSVImportModal (conditional)
```

---

## Custom Hooks

All API calls go through `src/api/client.js` — a single axios instance with `baseURL: '/api'`.

### `useRFQList()`

```js
// Returns: { rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage }
// GET /api/rfq?limit=20&offset=N&search=...
// deleteRFQ(id, search): DELETE /api/rfq/:id then refetch
// goToPage(offset, search): update offset + search params
```

### `useRFQ(id)`

```js
// Returns: { rfq, loading, error, setRFQ }
// GET /api/rfq/:id
// setRFQ: allows parent to update local rfq state after award/void/edit
```

### `useQuotes(rfqId)`

```js
// Returns: { data, loading, error, fetchQuotes, deleteQuote }
// data: { rfq, quotes[], best_quote_id, summary } | null
// GET /api/rfq/:rfqId/quotes on mount and after mutations
```

### `useCreateRFQ()`

```js
// Returns: { createRFQ(data), loading, error, fieldErrors }
// POST /api/rfq → navigate to /rfq/:id on success
```

### `useEditRFQ()`

```js
// Returns: { editRFQ(id, data), loading, error, fieldErrors }
// PUT /api/rfq/:id — returns updated RFQResponse
```

### `useAddQuote(rfqId, onSuccess)`

```js
// Returns: { addQuote(data), loading, error, fieldErrors }
// POST /api/rfq/:rfqId/quotes
```

### `useEditQuote()`

```js
// Returns: { editQuote(id, data), loading, error, fieldErrors }
// PUT /api/quote/:id — returns updated QuoteResponse
```

### `useAwardQuote()`

```js
// Returns: { awardQuote(rfqId, quoteId), loading, error }
// POST /api/rfq/:rfqId/award — returns updated RFQResponse
```

### `useVoidRFQ()`

```js
// Returns: { voidRFQ(rfqId), loading, error }
// POST /api/rfq/:rfqId/void — returns updated RFQResponse
```

### `useCSVImport(rfqId)`

```js
// Returns: { importCSV(file), result, loading, error, reset }
// POST /api/rfq/:rfqId/quotes/import (multipart)
// result: { imported, failed, errors, quotes }
```

---

## Layout Notes

- `#root`: `flex-direction: row` (overrides Vite boilerplate column)
- `.content`: `height: 100svh; overflow-y: auto` — the scroll container; sticky pagination relies on this
- `.page`: `flex: 1; display: flex; flex-direction: column` with no `max-width`
- `.pagination`: `position: sticky; bottom: 0; justify-content: center`
- `.section-header`: flex row for section heading + right-aligned action button(s)
- `AddQuoteModal` and `CSVImportModal` import `CreateRFQModal.css` (shared modal chrome)

---

## Status Badge CSS

```css
.rfq-status-badge          /* base chip */
.rfq-status-badge.status-open      /* neutral grey */
.rfq-status-badge.status-awarded   /* green */
.rfq-status-badge.status-void      /* muted grey + line-through */
```

---

## Form Validation

Client-side validation mirrors server-side rules. Fires on blur and on submit.

| Field | Rule | Error |
|---|---|---|
| `item_name` | Non-empty | "Item name is required." |
| `quantity` | `parseFloat > 0` | "Quantity must be a positive number." |
| `supplier_name` | Non-empty | "Supplier name is required." |
| `unit_price` | `parseFloat >= 0` | "Unit price must be 0 or greater." |
| `currency` | Exactly 3 letters | "Currency must be a 3-letter code (e.g., USD)" |

Submit button disabled while `loading === true`. Field-level 422 errors are mapped back to inputs via the `loc` array in the Pydantic error response.

---

## Vite Proxy

```js
// client/vite.config.js
server: { proxy: { '/api': 'http://localhost:8000' } }
```

All `fetch('/api/...')` calls proxy to the FastAPI backend in development. Eliminates CORS in dev.
