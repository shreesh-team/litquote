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
        <h1>RFQs</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New RFQ
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : rfqs.length === 0 ? (
        <div className="empty-state">
          <p>No RFQs yet. Create your first one.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New RFQ
          </button>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Delivery</th>
                  <th>Quotes</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td>{rfq.item_name}</td>
                    <td>{rfq.quantity}</td>
                    <td>{rfq.delivery_expectation ?? '—'}</td>
                    <td>{rfq.quote_count}</td>
                    <td>{new Date(rfq.created_at).toLocaleDateString()}</td>
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
              {total === 0 ? '0' : `${offset + 1}–${Math.min(offset + limit, total)}`} of {total}
            </span>
            <button
              className="btn btn-sm"
              disabled={offset === 0}
              onClick={() => goToPage(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <button
              className="btn btn-sm"
              disabled={offset + limit >= total}
              onClick={() => goToPage(offset + limit)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && <CreateRFQModal onClose={handleModalClose} />}
    </div>
  )
}
