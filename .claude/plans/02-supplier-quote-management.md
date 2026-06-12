# Plan: Supplier Quote Management (Feature Spec 02)

## Context

The `supplier_quote` table already exists in the DB schema (migration `001_initial_schema.sql`).
The RFQ detail page (`RFQDetailPage.jsx`) has a placeholder section for quotes.
This plan wires up the full quote add / list / delete flow end-to-end.

---

## Backend

### 1. `server/models/quote.py` (new)

Follow the same pattern as `models/rfq.py`.

```
QuoteCreate
  supplier_name: str  Field(min_length=1, max_length=255), validator strips blank
  unit_price:    Decimal  Field(ge=0)
  currency:      str  Field(default='USD'), before-validator auto-uppercases, pattern ^[A-Z]{3}$
  lead_time_days: int | None  Field(default=None, ge=0)
  payment_terms: str | None  Field(default=None, max_length=255)
  remarks:       str | None = None

QuoteResponse  (model_config from_attributes=True)
  id, rfq_id: UUID
  supplier_name, currency, source: str
  unit_price, total_price: Decimal
  lead_time_days: int | None
  payment_terms, remarks: str | None
  created_at: datetime
  is_best_quote: bool

QuoteListResponse
  rfq: RFQResponse  (import from models.rfq)
  quotes: list[QuoteResponse]
  best_quote_id: UUID | None
  summary: dict  { quote_count, min_total_price, max_total_price, currency_warning }
```

### 2. `server/services/comparison.py` (new)

```python
def enrich_quotes(quotes: list[dict], rfq_quantity: Decimal) -> tuple[list[dict], UUID | None]:
    # sets total_price = unit_price * rfq_quantity on each quote dict
    # sets is_best_quote = True for all quotes tied at min(total_price)
    # returns (enriched_quotes, best_quote_id)  — best_quote_id is the id of first best quote
```

### 3. `server/routers/quotes.py` (new)

Prefix: `/api`  (routes below are full paths)

**POST `/api/rfq/{rfq_id}/quotes`** → 201 QuoteResponse
- Verify RFQ exists; 404 if not.
- INSERT into `supplier_quote` with `source = 'manual'`.
- Fetch the new quote row + rfq.quantity.
- Enrich via `comparison.enrich_quotes` (all quotes for the RFQ, so is_best_quote is correct).
- Return the new quote's enriched dict.

**GET `/api/rfq/{rfq_id}/quotes`** → 200 QuoteListResponse
- Verify RFQ exists; 404 if not.
- SELECT all quotes for the RFQ ordered by `created_at ASC`.
- Enrich via `comparison.enrich_quotes`.
- Build summary: `{ quote_count, min_total_price, max_total_price, currency_warning }`.
  - `currency_warning = True` when >1 distinct currency code.
- Return `{ rfq, quotes, best_quote_id, summary }`.

**DELETE `/api/quote/{quote_id}`** → 204 / 404
- `DELETE FROM supplier_quote WHERE id = %s RETURNING id`.
- 404 if not found, else 204.

`_row_to_dict` helper: same positional-unpack pattern as rfq router.

### 4. `server/main.py` — register router

```python
from routers import rfq, quotes
app.include_router(quotes.router)
```

---

## Frontend

### 5. `client/src/hooks/useQuotes.js` (new)

Fetches and mutates quotes for one RFQ. Wraps `GET /api/rfq/:id/quotes` and `DELETE /api/quote/:quoteId`.

```javascript
export function useQuotes(rfqId) {
  // state: { data: { rfq, quotes, best_quote_id, summary } | null, loading, error }
  // fetchQuotes() — useCallback, re-fetches and re-enriches
  // deleteQuote(quoteId) — DELETE then fetchQuotes(); on 404 also re-fetches
  // return { data, loading, error, fetchQuotes, deleteQuote }
}
```

### 6. `client/src/hooks/useAddQuote.js` (new)

Handles form submission for a single new quote.

```javascript
export function useAddQuote(rfqId, onSuccess) {
  // state: loading, error (banner), fieldErrors (per-field 422)
  // addQuote(formData) — POST, on success call onSuccess(), on 422 set fieldErrors
  // return { addQuote, loading, error, fieldErrors }
}
```

`onSuccess` callback lets the page re-fetch quotes after a successful add.

### 7. `client/src/components/QuoteTable.jsx` + `QuoteTable.css` (new)

Renders the comparison table. Props: `{ quotes, bestQuoteId, onDelete, currencyWarning }`.

Columns: Supplier | Unit Price | Currency | Total Price | Lead Time | Payment Terms | Remarks | Action

- Best-quote row gets a highlight class (e.g. `.row--best`).
- If `currencyWarning`, show an inline banner above the table.
- "Delete" button per row — calls `onDelete(quote.id)`.
- Empty state: "No quotes yet."

### 8. `client/src/components/AddQuoteForm.jsx` + `AddQuoteForm.css` (new)

Uncontrolled form below the table. Fields match `QuoteCreate`.

- Currency input auto-uppercases on change.
- Client-side blur + submit validation (mirrors spec §QUOTE-1 Validation).
- Submit button disabled while `loading`.
- On success: reset form to defaults (currency → "USD").
- Inline field errors for 422; toast/banner for 500.

### 9. `client/src/pages/RFQDetailPage.jsx` — update

Replace the placeholder section with:

```jsx
const { data, loading: quotesLoading, error: quotesError, fetchQuotes, deleteQuote } = useQuotes(id)
const { addQuote, loading: addLoading, error: addError, fieldErrors } = useAddQuote(id, fetchQuotes)

<section className="section">
  <h2>Supplier Quotes</h2>
  {quotesLoading ? <div className="loading">Loading quotes…</div> : (
    <QuoteTable
      quotes={data?.quotes ?? []}
      bestQuoteId={data?.best_quote_id}
      onDelete={deleteQuote}
      currencyWarning={data?.summary?.currency_warning}
    />
  )}
  <AddQuoteForm onSubmit={addQuote} loading={addLoading} error={addError} fieldErrors={fieldErrors} />
</section>
```

---

## Files to Create / Edit

| Action | Path |
|--------|------|
| Create | `server/models/quote.py` |
| Create | `server/services/__init__.py` (empty) |
| Create | `server/services/comparison.py` |
| Create | `server/routers/quotes.py` |
| Edit   | `server/main.py` — add `quotes` router |
| Create | `client/src/hooks/useQuotes.js` |
| Create | `client/src/hooks/useAddQuote.js` |
| Create | `client/src/components/QuoteTable.jsx` + `QuoteTable.css` |
| Create | `client/src/components/AddQuoteForm.jsx` + `AddQuoteForm.css` |
| Edit   | `client/src/pages/RFQDetailPage.jsx` |

No DB migration needed — `supplier_quote` table exists in `001_initial_schema.sql`.

---

## Verification

1. Start backend: `uv run uvicorn main:app --reload --port 8000` in `server/`.
2. Start frontend: `npm run dev` in `client/`.
3. Open `http://localhost:5173/rfq`, navigate into an existing RFQ.
4. Add a quote with only `supplier_name` + `unit_price` — table updates without reload.
5. Add a second quote with `unit_price = 0` — it becomes the best quote.
6. Try `unit_price = -1` — expect inline validation error, no submission.
7. Try `currency = "US"` — expect inline validation error.
8. Type `usd` in currency — it auto-uppercases to `USD`.
9. Delete one quote — row disappears; best-quote highlight recalculates.
10. POST to `/api/rfq/<nonexistent-uuid>/quotes` via Swagger — expect 404.
