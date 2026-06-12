import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import EditQuoteModal from './EditQuoteModal'
import './QuoteTable.css'

const PAGE_SIZE = 10

const SORT_COLS = {
  supplier_name: (a, b) => a.supplier_name.localeCompare(b.supplier_name),
  unit_price:    (a, b) => Number(a.unit_price) - Number(b.unit_price),
  total_price:   (a, b) => Number(a.total_price) - Number(b.total_price),
  lead_time_days: (a, b) => {
    if (a.lead_time_days == null && b.lead_time_days == null) return 0
    if (a.lead_time_days == null) return 1
    if (b.lead_time_days == null) return -1
    return a.lead_time_days - b.lead_time_days
  },
}

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey) return <span className="sort-icon sort-icon--idle">↕</span>
  return <span className="sort-icon sort-icon--active">{sortDir === 'asc' ? '▲' : '▼'}</span>
}

export default function QuoteTable({ quotes, onDelete, onAward, onRefresh, rfq, currencyWarning }) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState('total_price')
  const [sortDir, setSortDir] = useState('asc')
  const [confirmQuote, setConfirmQuote] = useState(null)
  const [awardingQuote, setAwardingQuote] = useState(null)
  const [editQuote, setEditQuote] = useState(null)

  const handleSort = (col) => {
    if (col === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sorted = [...quotes].sort((a, b) => {
    const cmp = SORT_COLS[sortKey](a, b)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageQuotes = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const handleDeleteConfirm = async () => {
    const q = confirmQuote
    setConfirmQuote(null)
    await onDelete(q.id)
  }

  const handleAwardConfirm = async () => {
    const q = awardingQuote
    setAwardingQuote(null)
    await onAward(q.id)
  }

  if (quotes.length === 0) {
    return (
      <div className="quote-table-wrapper">
        <div className="quote-empty">
          <div className="quote-empty-icon">💬</div>
          <strong>No quotes yet</strong>
          <span>Add a quote manually or import from CSV to start comparing.</span>
        </div>
      </div>
    )
  }

  const isLocked = rfq?.status !== 'open'

  return (
    <div className="quote-table-wrapper">
      {currencyWarning && (
        <div className="alert alert-warning">
          ⚠ Quotes use mixed currencies. Total price comparison may not be meaningful.
        </div>
      )}
      <table className="quote-table">
        <thead>
          <tr>
            <th className="th-sort" onClick={() => handleSort('supplier_name')}>
              Supplier <SortIcon col="supplier_name" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className="th-sort" onClick={() => handleSort('unit_price')}>
              Unit Price <SortIcon col="unit_price" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th>Currency</th>
            <th className="th-sort" onClick={() => handleSort('total_price')}>
              Total Price <SortIcon col="total_price" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className="th-sort" onClick={() => handleSort('lead_time_days')}>
              Lead Time <SortIcon col="lead_time_days" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th>Payment Terms</th>
            <th>Remarks</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageQuotes.map((q) => (
            <tr
              key={q.id}
              className={[
                q.is_awarded ? 'row--awarded' : (q.is_best_quote ? 'row--best' : ''),
              ].filter(Boolean).join(' ')}
            >
              <td>
                {q.supplier_name}
                {q.is_awarded && <span className="badge badge-awarded">Awarded</span>}
                {!q.is_awarded && q.is_best_quote && <span className="badge badge-best">Best Price</span>}
              </td>
              <td className="num">{Number(q.unit_price).toFixed(2)}</td>
              <td>{q.currency}</td>
              <td className={`num${q.is_best_quote && !q.is_awarded ? ' num--best' : ''}${q.is_awarded ? ' num--awarded' : ''}`}>
                {Number(q.total_price).toFixed(2)}
              </td>
              <td>
                {q.lead_time_days != null ? `${q.lead_time_days} days` : '—'}
                {q.delivery_risk && <span className="badge badge-risk">Late delivery risk</span>}
              </td>
              <td>{q.payment_terms || '—'}</td>
              <td className="remarks-cell">{q.remarks || '—'}</td>
              <td>
                <span className={`badge badge-source ${q.source}`}>
                  {q.source === 'csv' ? 'CSV' : 'Manual'}
                </span>
              </td>
              <td className="actions-cell">
                {!isLocked && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setAwardingQuote(q)}
                  >
                    Award
                  </button>
                )}
                {!isLocked && (
                  <button className="btn btn-sm" onClick={() => setEditQuote(q)}>
                    Edit
                  </button>
                )}
                {!isLocked && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmQuote(q)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="quote-pagination">
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            ← Prev
          </button>
          <span className="pagination-count">
            Page {safePage + 1} of {totalPages} ({quotes.length} quotes)
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
          >
            Next →
          </button>
        </div>
      )}

      {confirmQuote && (
        <ConfirmModal
          message={`Delete the quote from "${confirmQuote.supplier_name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmQuote(null)}
        />
      )}

      {awardingQuote && (
        <ConfirmModal
          message={`Award this RFQ to "${awardingQuote.supplier_name}" at ${awardingQuote.currency} ${Number(awardingQuote.total_price).toFixed(2)}?`}
          confirmLabel="Award"
          danger={false}
          onConfirm={handleAwardConfirm}
          onCancel={() => setAwardingQuote(null)}
        />
      )}

      {editQuote && (
        <EditQuoteModal
          quote={editQuote}
          onSuccess={onRefresh}
          onClose={() => setEditQuote(null)}
        />
      )}
    </div>
  )
}
