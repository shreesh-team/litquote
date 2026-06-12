# Implementation Plan: RFQ Management (Feature Spec 01)

## Context

The project scaffold existed with only a minimal FastAPI app and a React boilerplate. This plan documents the full RFQ Management feature as built: create, list, view, and delete RFQs — the root entity that all supplier quotes belong to.

---

## Scope

- **4 API endpoints:** POST, GET (list), GET (detail), DELETE for `/api/rfq`
- **2 frontend pages:** RFQ List (with inline create modal), RFQ Detail (summary card; quotes section is Feature Spec 02/03)
- **App shell:** Persistent sidebar nav wrapping all routes
- **Database migration:** `rfq` + `supplier_quote` tables DDL
- **No editing of existing RFQs** (out of scope per spec)

---

## Implementation Order

Backend first (testable via Swagger UI at `/docs`), then frontend.

---

## Step 1 — Backend: Database Layer

### `server/db/__init__.py`
Empty package marker.

### `server/db/connection.py`
- `psycopg2.pool.ThreadedConnectionPool(minconn=2, maxconn=10)` from `DATABASE_URL` env var
- On pool init: acquires and immediately releases a probe connection; logs `DB: connection pool initialised OK` or `DB: connection pool FAILED — <reason>`
- `get_db()` — FastAPI dependency: acquires connection, yields, returns to pool
- `run_migrations()` — creates `schema_migrations` tracking table if absent; applies each `.sql` file in `db/migrations/` in sort order; skips already-applied files; logs each applied filename and a summary count

### `server/db/migrations/001_initial_schema.sql`
Creates `rfq` and `supplier_quote` tables with `IF NOT EXISTS` guards and indexes. Both tables created in one migration. `supplier_quote.rfq_id` references `rfq(id) ON DELETE CASCADE`.

---

## Step 2 — Backend: Pydantic Models

### `server/models/rfq.py`
- `RFQCreate` — `item_name` (non-empty str, max 255), `quantity` (Decimal, > 0), optional `material_spec`, `delivery_expectation` (date), `notes`
- `RFQResponse` — all fields + `id` (UUID), `created_at`, `updated_at`, `quote_count` (int)
- `RFQListResponse` — `{ items, total, limit, offset }`

Use `Decimal` (never `float`) for `quantity`. `model_config = ConfigDict(from_attributes=True)`.

---

## Step 3 — Backend: RFQ Router

### `server/routers/rfq.py`

| Method | Path | Notes |
|--------|------|-------|
| `POST /api/rfq` | Returns 201. **`INSERT ... RETURNING` uses bare column names — no table alias.** `quote_count` hardcoded to `0` (new RFQ always has zero quotes). |
| `GET /api/rfq` | `ORDER BY created_at DESC`, `LIMIT`/`OFFSET`. `quote_count` via correlated subquery using alias `r` in the SELECT. |
| `GET /api/rfq/{rfq_id}` | Returns 404 if not found. |
| `DELETE /api/rfq/{rfq_id}` | Returns 204. Returns 404 if row not found. Cascade handles quotes. |

> **Gotcha:** `INSERT ... RETURNING` does not support table aliases (`r.column` fails). Use plain column names in RETURNING and handle `quote_count` separately.

---

## Step 4 — Backend: `main.py`

- `lifespan` context manager calls `run_migrations()` on startup
- `rfq.router` included (prefix already on the router: `/api/rfq`)
- Generic `Exception` handler returns `{ "detail": "Something went wrong" }` with 500
- CORS middleware retained (`allow_origins=["http://localhost:5173"]`)

---

## Step 5 — Frontend: Setup

```bash
cd client
npm install react-router axios
```

### `client/vite.config.js`
```js
server: { proxy: { '/api': 'http://localhost:8000' } }
```

### `client/src/api/client.js`
Axios instance with `baseURL: '/api'`.

---

## Step 6 — Frontend: App Shell + Routing

### `client/src/components/Layout.jsx` + `Layout.css`
Persistent two-panel shell used by all routes:
- **Left sidebar (200px):** brand name + nav links. Currently: `RFQs` (active), `Quotes` (disabled placeholder).
- **Right content (flex: 1):** renders `<Outlet />` — the current page fills this area.
- `.content` is `height: 100svh; overflow-y: auto; display: flex; flex-direction: column` — it is the scroll container, which enables sticky pagination inside pages.

### `client/src/App.jsx`
```jsx
<BrowserRouter>
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Navigate to="/rfq" replace />} />
      <Route path="/rfq" element={<RFQListPage />} />
      <Route path="/rfq/:id" element={<RFQDetailPage />} />
    </Route>
  </Routes>
</BrowserRouter>
```
No `/rfq/new` route — create is handled by a modal on the list page.

---

## Step 7 — Frontend: Custom Hooks

### `useRFQList(limit=20)`
- `GET /api/rfq?limit=20&offset=<n>`
- Returns `{ rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage }`
- `deleteRFQ(id)` — `window.confirm()` → DELETE → refetch; on 404 silently refetches

### `useCreateRFQ()`
- `POST /api/rfq`
- Returns `{ createRFQ(data), loading, error, fieldErrors }`
- Maps Pydantic 422 `detail` array → `fieldErrors` keyed by field name
- On success: `navigate('/rfq/:id')` via `useNavigate`

### `useRFQ(id)`
- `GET /api/rfq/:id`
- Returns `{ rfq, loading, error }`; 404 surfaces as an error string

---

## Step 8 — Frontend: Pages & Components

### `client/src/pages/RFQListPage.jsx`
- Header: "RFQs" title + "+ New RFQ" button
- "+ New RFQ" opens `<CreateRFQModal>` (no page navigation)
- On modal close/cancel: calls `refetch()` to pick up any new row
- On modal success: hook navigates to detail page automatically
- Table: Item Name | Quantity | Delivery | Quotes | Created | Actions
- Per-row: "View" → `/rfq/:id`, "Delete" → confirm + DELETE
- Empty state with CTA button
- `.table-container` wraps table + pagination; uses `flex: 1` to push pagination to bottom

### `client/src/components/CreateRFQModal.jsx` + `CreateRFQModal.css`
Modal overlay (replaces the `/rfq/new` page):
- Closes on Escape or backdrop click
- Same validation logic as the old create page (on-blur + on-submit, field-level errors)
- Uses `useCreateRFQ` hook — navigates to detail on success, shows field/server errors inline

### `client/src/pages/RFQDetailPage.jsx`
- `useRFQ(id)` hook
- Renders `<RFQSummaryCard>` (read-only)
- Placeholder section for quotes (Feature Spec 02/03)

### `client/src/components/RFQSummaryCard.jsx`
Read-only card: Item Name, Material Spec, Quantity, Delivery Expectation, Notes, Quote Count, Created.

---

## Step 9 — Styling (`client/src/index.css`)

Key overrides on the boilerplate `#root`:
```css
#root {
  width: 100%; max-width: 100%; margin: 0;
  text-align: left; border-inline: none;
  flex-direction: row; /* override boilerplate column */
}
```

`.page` — `flex: 1; display: flex; flex-direction: column; padding: 32px 40px` (no `max-width` — content fills the right panel).

`.pagination` — `position: sticky; bottom: 0; background: var(--bg); justify-content: center` — sticks to the bottom of the `.content` scroll container.

`.table-container` — `flex: 1; display: flex; flex-direction: column` — grows to fill the page, pushing pagination to the bottom.

No external CSS framework; uses existing boilerplate CSS custom properties (`--accent`, `--border`, `--bg`, etc.).

---

## Files Created / Modified

| File | Action |
|------|--------|
| `server/db/__init__.py` | Created |
| `server/db/connection.py` | Created |
| `server/db/migrations/001_initial_schema.sql` | Created |
| `server/models/__init__.py` | Created |
| `server/models/rfq.py` | Created |
| `server/routers/__init__.py` | Created |
| `server/routers/rfq.py` | Created |
| `server/main.py` | Modified |
| `client/vite.config.js` | Modified (proxy added) |
| `client/src/api/client.js` | Created |
| `client/src/App.jsx` | Modified (shell layout + routes) |
| `client/src/components/Layout.jsx` | Created |
| `client/src/components/Layout.css` | Created |
| `client/src/components/CreateRFQModal.jsx` | Created |
| `client/src/components/CreateRFQModal.css` | Created |
| `client/src/components/RFQSummaryCard.jsx` | Created |
| `client/src/hooks/useRFQList.js` | Created |
| `client/src/hooks/useCreateRFQ.js` | Created |
| `client/src/hooks/useRFQ.js` | Created |
| `client/src/pages/RFQListPage.jsx` | Created |
| `client/src/pages/RFQDetailPage.jsx` | Created |
| `client/src/index.css` | Modified (app styles added) |

> `client/src/pages/CreateRFQPage.jsx` was created during initial implementation but superseded by the modal approach and is unused. Safe to delete.

---

## Verification

1. **Backend** — start server, open `http://localhost:8000/docs`:
   - `POST /api/rfq` valid body → 201; empty `item_name` → 422; `quantity ≤ 0` → 422
   - `GET /api/rfq` → 200 with `{ items, total, limit, offset }`
   - `GET /api/rfq/{id}` → 200; unknown ID → 404
   - `DELETE /api/rfq/{id}` → 204; repeat → 404
   - Server log shows `DB: connection pool initialised OK` and migration status on startup

2. **Frontend** — `npm run dev`, open `http://localhost:5173`:
   - `/` redirects to `/rfq`; sidebar shows "RFQs" active
   - Empty state shown initially; "+ New RFQ" opens modal
   - Modal: empty submit shows field errors; valid submit navigates to detail page
   - Detail page shows summary card; back to list shows new RFQ at top
   - Delete: confirm dialog → row removed; repeat delete on same ID does not crash
   - Pagination bar sticks to bottom of viewport, centered
