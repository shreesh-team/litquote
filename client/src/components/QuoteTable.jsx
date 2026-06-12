import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import EditQuoteModal from './EditQuoteModal'
import './QuoteTable.css'

const PAGE_SIZE = 10

export default function QuoteTable({ quotes, onDelete, onAward, onRefresh, rfq, currencyWarning }) {
  const [page, setPage] = useState(0)
  const [confirmQuote, setConfirmQuote] = useState(null)
  const [awardingQuote, setAwardingQuote] = useState(null)
  const [editQuote, setEditQuote] = useState(null)

  const totalPages = Math.max(1, Math.ceil(quotes.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageQuotes = quotes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

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
            <th>Supplier</th>
            <th>Unit Price</th>
            <th>Currency</th>
            <th>Total Price</th>
            <th>Lead Time</th>
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
