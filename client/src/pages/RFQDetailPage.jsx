import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useRFQ } from '../hooks/useRFQ'
import { useQuotes } from '../hooks/useQuotes'
import { useAwardQuote } from '../hooks/useAwardQuote'
import { useVoidRFQ } from '../hooks/useVoidRFQ'
import RFQSummaryCard from '../components/RFQSummaryCard'
import QuoteTable from '../components/QuoteTable'
import AddQuoteModal from '../components/AddQuoteModal'
import CSVImportModal from '../components/CSVImportModal'
import EditRFQModal from '../components/EditRFQModal'
import ConfirmModal from '../components/ConfirmModal'

function StatusBadge({ status }) {
  const map = {
    open: { label: 'Open', cls: 'status-open' },
    awarded: { label: 'Awarded', cls: 'status-awarded' },
    void: { label: 'Void', cls: 'status-void' },
  }
  const { label, cls } = map[status] ?? map.open
  return <span className={`rfq-status-badge ${cls}`}>{label}</span>
}

function InsightBanner({ rfq, quotes }) {
  if (!quotes || quotes.length === 0) return null

  const awarded = quotes.find((q) => q.is_awarded)
  if (awarded) {
    return (
      <div className="insight-banner insight-banner--awarded">
        <span className="insight-icon">✓</span>
        <span>
          Awarded to <strong>{awarded.supplier_name}</strong> —{' '}
          {awarded.currency} {Number(awarded.total_price).toFixed(2)}
          {awarded.delivery_risk && <span className="insight-risk"> · ⚠ Delivery risk</span>}
        </span>
      </div>
    )
  }

  const best = quotes.find((q) => q.is_best_quote)
  if (!best) return null

  const totals = quotes.map((q) => Number(q.total_price)).sort((a, b) => a - b)
  const savings = totals.length > 1 ? totals[1] - totals[0] : null

  return (
    <div className="insight-banner">
      <span className="insight-icon">★</span>
      <span>
        Best option: <strong>{best.supplier_name}</strong> at{' '}
        {best.currency} {Number(best.total_price).toFixed(2)}
        {savings != null && savings > 0 && (
          <> · saves {best.currency} {savings.toFixed(2)} vs. next best</>
        )}
        {best.delivery_risk
          ? <span className="insight-risk"> · ⚠ Delivery risk</span>
          : rfq.delivery_expectation
            ? <span className="insight-ok"> · Delivers on time</span>
            : null
        }
      </span>
    </div>
  )
}

export default function RFQDetailPage() {
  const { id } = useParams()
  const { rfq, loading, error, setRFQ } = useRFQ(id)
  const { data: quotesData, loading: quotesLoading, error: quotesError, fetchQuotes, deleteQuote } = useQuotes(id)
  const { awardQuote } = useAwardQuote()
  const { voidRFQ } = useVoidRFQ()
  const [modalOpen, setModalOpen] = useState(false)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [editRFQOpen, setEditRFQOpen] = useState(false)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)

  const handleAward = async (quoteId) => {
    const updatedRfq = await awardQuote(id, quoteId)
    if (updatedRfq) {
      setRFQ(updatedRfq)
      await fetchQuotes()
    }
  }

  const handleVoidConfirm = async () => {
    setVoidConfirmOpen(false)
    const updatedRfq = await voidRFQ(id)
    if (updatedRfq) {
      setRFQ(updatedRfq)
      await fetchQuotes()
    }
  }

  if (loading) return <div className="page"><div className="loading">Loading RFQ…</div></div>
  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <Link to="/rfq" className="back-link">← Back to RFQs</Link>
    </div>
  )

  const isOpen = rfq.status === 'open'
  const isVoid = rfq.status === 'void'
  const canEdit = isOpen
  const canVoid = !isVoid

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/rfq" className="back-link">← RFQs</Link>
          <h1 style={{ marginTop: 4 }}>{rfq.item_name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StatusBadge status={rfq.status} />
          {canEdit && (
            <button className="btn btn-sm" onClick={() => setEditRFQOpen(true)}>
              Edit RFQ
            </button>
          )}
          {canVoid && (
            <button className="btn btn-sm btn-danger" onClick={() => setVoidConfirmOpen(true)}>
              Void RFQ
            </button>
          )}
        </div>
      </div>

      <RFQSummaryCard rfq={rfq} />

      <section className="section section--fill">
        <div className="section-header">
          <h2>Supplier Quotes</h2>
          {isOpen && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm" onClick={() => setCsvModalOpen(true)}>
                ↑ Upload CSV
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
                + Add Quote
              </button>
            </div>
          )}
        </div>

        {rfq.status === 'awarded' && (
          <div className="lock-notice">
            🔒 This RFQ has been awarded and is locked. Void it to reject the decision.
          </div>
        )}
        {isVoid && (
          <div className="lock-notice">
            🚫 This RFQ has been voided and is closed.
          </div>
        )}

        {quotesError && <div className="alert alert-error">{quotesError}</div>}

        {!quotesLoading && quotesData && (
          <InsightBanner rfq={rfq} quotes={quotesData.quotes} />
        )}

        {quotesLoading ? (
          <div className="loading">Loading quotes…</div>
        ) : (
          <QuoteTable
            quotes={quotesData?.quotes ?? []}
            rfq={rfq}
            onDelete={deleteQuote}
            onAward={handleAward}
            onRefresh={fetchQuotes}
            currencyWarning={quotesData?.summary?.currency_warning}
          />
        )}
      </section>

      {modalOpen && (
        <AddQuoteModal
          rfqId={id}
          onSuccess={fetchQuotes}
          onClose={() => setModalOpen(false)}
        />
      )}

      {csvModalOpen && (
        <CSVImportModal
          rfqId={id}
          onSuccess={fetchQuotes}
          onClose={() => setCsvModalOpen(false)}
        />
      )}

      {editRFQOpen && (
        <EditRFQModal
          rfq={rfq}
          onClose={() => setEditRFQOpen(false)}
          onSuccess={(updated) => {
            setRFQ(updated)
            setEditRFQOpen(false)
            fetchQuotes()
          }}
        />
      )}

      {voidConfirmOpen && (
        <ConfirmModal
          message={
            rfq.status === 'awarded'
              ? `Void "${rfq.item_name}"? This will reject the awarded decision. This action cannot be undone.`
              : `Void "${rfq.item_name}"? This will close the RFQ as rejected. This action cannot be undone.`
          }
          confirmLabel="Void RFQ"
          danger={true}
          onConfirm={handleVoidConfirm}
          onCancel={() => setVoidConfirmOpen(false)}
        />
      )}
    </div>
  )
}
