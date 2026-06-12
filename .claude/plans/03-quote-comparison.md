# Plan: Feature Spec 03 — Quote Comparison

## Context

The core comparison table is partially implemented but diverges from the spec in several visual and behavioral details. The backend service (`enrich_quotes`) correctly computes `total_price` and `is_best_quote`, but does not sort quotes by `total_price ASC` — the router sorts by `created_at`. The frontend table renders all quote data but is missing the Source column, uses the wrong best-quote visual treatment (CSS star instead of a badge + green row styles), formats prices to 4 decimal places instead of 2, and has stale copy in the empty state and currency warning.

Two additional comparison metrics were added beyond the spec: delivery risk flagging and a lead-time tiebreaker.

---

## Changes

### 1. Backend — `server/services/comparison.py`

- Compute `total_price = unit_price × rfq_quantity` per quote
- Compute `delivery_risk = today + lead_time_days > delivery_expectation` (False if either field is null)
- Set `is_best_quote = True` for all quotes tied at minimum `total_price`
- Sort by `(total_price ASC, lead_time_days ASC)` — ties broken by shortest lead time; null lead time sorts last
- Accept `delivery_expectation: date | None` as a new parameter

### 2. Backend — `server/routers/quotes.py`

- Remove `ORDER BY q.created_at ASC` from `list_quotes` (sort now owned by the service)
- Pass `rfq["delivery_expectation"]` to `enrich_quotes` on both `list_quotes` and `add_quote` endpoints

### 3. Backend — `server/models/quote.py`

- Add `delivery_risk: bool` to `QuoteResponse`

### 4. Frontend — `client/src/components/QuoteTable.jsx`

- Add `<th>Source</th>` column with pill badges (`"manual"` → grey "Manual", `"csv"` → blue "CSV")
- Switch best-quote detection to `q.is_best_quote` (handles ties; removes dependency on `bestQuoteId` prop)
- Append `<span className="badge badge-best">Best Price</span>` in Supplier cell for best rows
- Add `num--best` class to Total Price cell for best rows (bold + green text)
- Format prices to 2 decimal places (`.toFixed(2)`)
- Lead time: `"X days"` format (was `"Xd"`)
- Show `<span className="badge badge-risk">Late delivery risk</span>` next to lead time when `q.delivery_risk`
- Empty state: `"No quotes yet. Add a quote below or import from CSV."`
- Currency warning: `"⚠ Quotes use mixed currencies. Total price comparison may not be meaningful."`

### 5. Frontend — `client/src/components/QuoteTable.css`

- `.row--best`: background `#f0fdf4`, left border `4px solid #22c55e` (remove `::before` star)
- `.num--best`: `font-weight: 700; color: #15803d`
- `.badge-best`: green pill
- `.badge-source.manual` / `.badge-source.csv`: grey / blue pills
- `.badge-risk`: red pill (`#fef2f2` bg, `#b91c1c` text)
- `.alert-warning`: background `#fffbeb`, border `#f59e0b`, text `#92400e`

### 6. Frontend — `client/src/pages/RFQDetailPage.jsx`

- Remove `bestQuoteId` prop from `<QuoteTable>` call (no longer used)

---

## Files Modified

| File | Change |
|---|---|
| `server/services/comparison.py` | Sort, delivery_risk, tiebreaker, delivery_expectation param |
| `server/routers/quotes.py` | Pass delivery_expectation; remove ORDER BY |
| `server/models/quote.py` | Add delivery_risk field |
| `client/src/components/QuoteTable.jsx` | Source col, badges, formatting, delivery risk |
| `client/src/components/QuoteTable.css` | Row/badge/warning styles |
| `client/src/pages/RFQDetailPage.jsx` | Remove bestQuoteId prop |

---

## Verification

1. Start backend (`uv run uvicorn main:app --reload --port 8000`) and frontend (`npm run dev`)
2. Open an RFQ that has quotes with different suppliers — confirm sorted cheapest first
3. Cheapest row: green background + left border + "Best Price" badge + bold green Total Price
4. Add a second quote with the same total price → both rows highlighted
5. Among tied quotes, the one with fewer lead days should appear first
6. Delete a quote → highlight moves to new cheapest without page reload
7. Add a quote in a different currency → ⚠ warning banner appears; delete it → banner disappears
8. Add a quote whose lead time would miss the RFQ delivery date → "Late delivery risk" badge appears
9. Zero-quote state shows correct empty message
10. Price columns display 2 decimal places; Lead Time shows "X days"
11. Source column shows grey "Manual" or blue "CSV" pill
12. Viewport < 768px → table scrolls horizontally, no data clipped
