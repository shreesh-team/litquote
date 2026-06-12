# Frontend Guide

## Routing Structure

Using React Router v7. Add it to dependencies: `npm install react-router`.

| Route | Component | Purpose |
|---|---|---|
| `/` | redirect | Redirects to `/rfq` |
| `/rfq` | `RFQListPage` | Browse all RFQs |
| `/rfq/new` | `CreateRFQPage` | Create a new RFQ |
| `/rfq/:id` | `RFQDetailPage` | View RFQ, add quotes, compare, import CSV |

The add-quote form and CSV import live as sections on the detail page (not separate routes). This keeps the comparison workflow fluid — the user never navigates away from the table to add data to it.

---

## Page Inventory

### `RFQListPage` — `/rfq`

**Data:** `GET /api/rfq` on mount.

**Layout:**
- Page header: "Requests for Quotation" + "Create New RFQ" button (top right)
- RFQ table with columns: Item Name | Quantity | Delivery | Quotes | Created | Actions
- "Actions" column: "View" link navigates to `/rfq/:id`; "Delete" triggers `DELETE /api/rfq/:id` with confirmation dialog
- Empty state (no RFQs yet): centered message "No RFQs yet." with a "Create your first RFQ" call-to-action button
- Loading state: skeleton rows or spinner
- Error state: inline error message with a retry button

---

### `CreateRFQPage` — `/rfq/new`

**Data:** `POST /api/rfq` on submit.

**Layout:**
- Back link: "← All RFQs"
- Page header: "New Request for Quotation"
- Form fields (in order):
  1. Item Name (text input, required)
  2. Material / Specification (textarea, optional)
  3. Quantity (number input, required, min > 0)
  4. Delivery Expectation (date input, optional)
  5. Notes (textarea, optional)
- Submit button: "Create RFQ" (disabled while loading)
- On success: navigate to `/rfq/{new_id}` — user lands directly on the detail page
- On 422 from API: display field-level error messages beneath each offending input

---

### `RFQDetailPage` — `/rfq/:id`

This is the core page. It has four visual sections rendered top to bottom:

**Section 1 — RFQ Summary Card** *(collapsible)*

Read-only card. **Collapsed by default** — shows Item Name, Quantity, and Delivery Expectation. A "Show more ▾ / Show less ▴" toggle at the bottom of the card reveals the remaining fields: Material Spec, Notes, Quote Count, Created date.

**Section 2 — Quote Comparison Table** *(paginated, 10 rows/page)*

| Column | Source |
|---|---|
| Supplier | `quote.supplier_name` |
| Unit Price | `quote.unit_price` (formatted with currency symbol) |
| Currency | `quote.currency` |
| Total Price | `quote.total_price` (bold if best) |
| Lead Time | `quote.lead_time_days` days |
| Payment Terms | `quote.payment_terms` |
| Remarks | `quote.remarks` |
| Source | Badge: "Manual" or "CSV" |
| Actions | Delete button |

Best-quote row styling:
- Row background: `#f0fdf4` (light green)
- Left border: `4px solid #22c55e`
- "Best Price" badge in the Supplier cell (green pill)
- Total Price cell: bold + green text

Currency warning banner (renders above the table if `summary.currency_warning === true`):
```
Warning: Quotes use mixed currencies (USD, EUR). 
Total price comparison may not be meaningful.
```

Pagination controls (Prev / Next + "Page X of Y (N quotes)") appear only when there are more than 10 quotes.

Empty state (no quotes yet):
```
No quotes yet. Add the first quote using the button above.
```

**Section 3 — Add Quote** *(modal)*

A "+ Add Quote" button sits right-aligned in the "Supplier Quotes" section header. Clicking it opens a 660px modal overlay. The modal contains the quote form and a Cancel button.

The modal closes automatically on successful submission. Escape key and clicking the backdrop also close it.

Form fields:
1. Supplier Name (text, required)
2. Unit Price (number, required, >= 0)
3. Currency (text, 3 chars, default "USD", auto-uppercased)
4. Lead Time (days) (number, optional)
5. Payment Terms (text, optional)
6. Remarks (textarea, optional)

On success: form resets, modal closes, comparison table re-fetches.

**Section 4 — CSV Import**

File input (`.csv` only) + "Import Quotes" button.

Below the import button: a "Download sample CSV" link that triggers a blob download of the sample format defined in `04-csv-format.md`.

After import:
- Summary banner: "4 quotes imported. 1 row failed."
- Error table (if any errors): Row | Field | Value | Error

---

## Component Tree

```
App
└── BrowserRouter
    └── Layout (navbar: "litquote" brand + "All RFQs" link)
        ├── RFQListPage
        │   ├── RFQTable
        │   │   └── RFQRow (× n)
        │   └── EmptyState
        ├── CreateRFQPage
        │   └── RFQForm
        └── RFQDetailPage
            ├── RFQSummaryCard (collapsible)
            ├── QuoteTable (paginated)
            │   ├── alert-warning banner (conditional, mixed currencies)
            │   ├── table rows (× n, best-quote row has ★ + accent bg)
            │   ├── empty state (if no quotes)
            │   └── pagination controls (if > 10 quotes)
            ├── AddQuoteModal (conditional, opens on "+ Add Quote" click)
            │   └── AddQuoteForm
            └── CSVImportSection
                └── CSVErrorTable (conditional)
```

---

## Custom Hooks

All API communication goes through `src/api/client.js` — a single axios instance:

```js
// src/api/client.js
import axios from 'axios'
export const api = axios.create({ baseURL: '/api' })
```

### `useRFQList()`

```js
// Returns: { rfqs, total, loading, error, refetch }
// Calls: GET /api/rfq
```

### `useRFQ(id)`

```js
// Returns: { rfq, quotes, bestQuoteId, summary, loading, error, refetch }
// Calls: GET /api/rfq/:id/quotes
// Note: also fetches the rfq detail embedded in that response
```

### `useCreateRFQ()`

```js
// Returns: { createRFQ(data), loading, error }
// Calls: POST /api/rfq
// On success: navigate to /rfq/:id
```

### `useQuotes(rfqId)`

```js
// Returns: { data, loading, error, fetchQuotes, deleteQuote }
// data: { rfq, quotes[], best_quote_id, summary } | null
// Calls: GET /api/rfq/:rfqId/quotes on mount and after mutations
// deleteQuote(quoteId): DELETE /api/quote/:quoteId then re-fetches
```

### `useAddQuote(rfqId, onSuccess)`

```js
// Returns: { addQuote(data), loading, error, fieldErrors }
// Calls: POST /api/rfq/:rfqId/quotes
// Returns true on success (triggers form reset), false on failure
// onSuccess callback fires before returning true (used to re-fetch + close modal)
```

### `useCSVImport(rfqId)`

```js
// Returns: { importCSV(file), result, loading, error }
// Calls: POST /api/rfq/:rfqId/quotes/import (multipart)
// result: { imported, failed, errors, quotes }
```

---

## Form Validation

Client-side validation mirrors server-side rules. Validation fires **on blur** (not on every keystroke) and on submit.

| Field | Rule | Error Message |
|---|---|---|
| `item_name` | Non-empty | "Item name is required" |
| `quantity` | `parseFloat > 0` | "Quantity must be greater than 0" |
| `supplier_name` | Non-empty | "Supplier name is required" |
| `unit_price` | `parseFloat >= 0` | "Unit price must be 0 or greater" |
| `currency` | Exactly 3 letters | "Currency must be a 3-letter code (e.g., USD)" |

The submit button is disabled while `loading === true` to prevent double-submission.

Field-level API errors (from 422 responses) are mapped back to individual inputs using the `loc` array in the Pydantic error response.

---

## Styling

- **No CSS framework** — plain CSS with CSS custom properties. Keeps the dependency count low and the code readable for evaluators.
- **System font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Color palette (CSS variables in `index.css`):**

```css
:root {
  --color-primary: #2563eb;
  --color-success: #22c55e;
  --color-success-bg: #f0fdf4;
  --color-warning: #f59e0b;
  --color-warning-bg: #fffbeb;
  --color-danger: #ef4444;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-bg: #ffffff;
  --color-bg-alt: #f9fafb;
}
```

- **Comparison table:** horizontally scrollable on small screens (`overflow-x: auto` on a wrapper div)
- **Best quote row CSS:**

```css
.quote-row--best {
  background-color: var(--color-success-bg);
  border-left: 4px solid var(--color-success);
}

.badge-best {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: var(--color-success);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 8px;
}
```

- **No animations, no transitions** — keeps the implementation focused on the assignment's evaluation criteria

---

## Vite Proxy Configuration

Update `client/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

This eliminates the need for CORS in development. All `api.get('/rfq')` calls transparently route to `http://localhost:8000/api/rfq`.

---

## Dependencies to Add

```bash
cd client
npm install react-router axios
```

No other new dependencies are needed. React 19 and Vite 8 are already in `package.json`.
