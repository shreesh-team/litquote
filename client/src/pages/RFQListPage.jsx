import { useState, useRef } from 'react'
import { Link } from 'react-router'
import { useRFQList } from '../hooks/useRFQList'
import CreateRFQModal from '../components/CreateRFQModal'
import ConfirmModal from '../components/ConfirmModal'

const STATUS_LABELS = {
  open: { label: 'Open', cls: 'status-open' },
  awarded: { label: 'Awarded', cls: 'status-awarded' },
  void: { label: 'Void', cls: 'status-void' },
}

export default function RFQListPage() {
  const [search, setSearch] = useState('')
  const { rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage } = useRFQList()
  const [showModal, setShowModal] = useState(false)
  const [confirmItem, setConfirmItem] = useState(null)
  const debounceRef = useRef(null)

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      goToPage(0, val)
    }, 300)
  }

  const handleModalClose = () => {
    setShowModal(false)
    refetch(search)
  }

  const handleDeleteConfirm = async () => {
    const item = confirmItem
    setConfirmItem(null)
    await deleteRFQ(item.id, search)
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

      <div className="search-bar">
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search RFQs by name…"
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading">Loading RFQs…</div>
      ) : rfqs.length === 0 ? (
        <div className="table-container">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>{search ? 'No RFQs match your search' : 'No RFQs yet'}</h3>
            <p>
              {search
                ? 'Try a different search term.'
                : 'Create your first RFQ to start collecting and comparing supplier quotes.'}
            </p>
            {!search && (
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                + New RFQ
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Status</th>
                  <th>Quantity</th>
                  <th>Delivery By</th>
                  <th>Quotes</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => {
                  const statusInfo = STATUS_LABELS[rfq.status] ?? STATUS_LABELS.open
                  return (
                    <tr key={rfq.id}>
                      <td>
                        <Link to={`/rfq/${rfq.id}`} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                          {rfq.item_name}
                        </Link>
                      </td>
                      <td>
                        <span className={`rfq-status-badge ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
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
                        {rfq.status === 'open' && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setConfirmItem(rfq)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
              onClick={() => goToPage(Math.max(0, offset - limit), search)}
            >
              ← Previous
            </button>
            <button
              className="btn btn-sm"
              disabled={offset + limit >= total}
              onClick={() => goToPage(offset + limit, search)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showModal && <CreateRFQModal onClose={handleModalClose} />}

      {confirmItem && (
        <ConfirmModal
          message={`Delete "${confirmItem.item_name}" and all its quotes? This cannot be undone.`}
          confirmLabel="Delete"
          danger={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmItem(null)}
        />
      )}
    </div>
  )
}
