import { useState } from 'react'
import { Link } from 'react-router'
import { useRFQList } from '../hooks/useRFQList'
import CreateRFQModal from '../components/CreateRFQModal'

export default function RFQListPage() {
  const { rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage } = useRFQList()
  const [showModal, setShowModal] = useState(false)

  const handleModalClose = () => {
    setShowModal(false)
    refetch()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Request for Quotations</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New RFQ
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading RFQs…</div>
      ) : rfqs.length === 0 ? (
        <div className="table-container">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No RFQs yet</h3>
            <p>Create your first RFQ to start collecting and comparing supplier quotes.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + New RFQ
            </button>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Delivery By</th>
                  <th>Quotes</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td>
                      <Link to={`/rfq/${rfq.id}`} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                        {rfq.item_name}
                      </Link>
                    </td>
                    <td>{rfq.quantity}</td>
                    <td>{rfq.delivery_expectation ?? <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="stat-chip">{rfq.quote_count}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(rfq.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="actions">
                      <Link to={`/rfq/${rfq.id}`} className="btn btn-sm">View</Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteRFQ(rfq.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="pagination-count">
              {total === 0 ? '0' : `${offset + 1}–${Math.min(offset + limit, total)}`} of {total} RFQs
            </span>
            <button
              className="btn btn-sm"
              disabled={offset === 0}
              onClick={() => goToPage(Math.max(0, offset - limit))}
            >
              ← Previous
            </button>
            <button
              className="btn btn-sm"
              disabled={offset + limit >= total}
              onClick={() => goToPage(offset + limit)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showModal && <CreateRFQModal onClose={handleModalClose} />}
    </div>
  )
}
