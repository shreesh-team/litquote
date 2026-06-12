import { useState } from 'react'
import './QuoteTable.css'

const PAGE_SIZE = 10

export default function QuoteTable({ quotes, bestQuoteId, onDelete, currencyWarning }) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(quotes.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageQuotes = quotes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (quotes.length === 0) {
    return <p className="text-muted">No quotes yet. Add the first quote using the button above.</p>
  }

  return (
    <div className="quote-table-wrapper">
      {currencyWarning && (
        <div className="alert alert-warning">
          Quotes use mixed currencies — totals are not directly comparable.
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageQuotes.map((q) => (
            <tr key={q.id} className={q.id === bestQuoteId ? 'row--best' : ''}>
              <td>{q.supplier_name}</td>
              <td className="num">{Number(q.unit_price).toFixed(4)}</td>
              <td>{q.currency}</td>
              <td className="num">{Number(q.total_price).toFixed(4)}</td>
              <td>{q.lead_time_days != null ? `${q.lead_time_days}d` : '—'}</td>
              <td>{q.payment_terms || '—'}</td>
              <td className="remarks-cell">{q.remarks || '—'}</td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(q.id)}
                >
                  Delete
                </button>
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
    </div>
  )
}
