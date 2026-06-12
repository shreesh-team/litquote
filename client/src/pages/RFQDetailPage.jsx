import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useRFQ } from '../hooks/useRFQ'
import { useQuotes } from '../hooks/useQuotes'
import RFQSummaryCard from '../components/RFQSummaryCard'
import QuoteTable from '../components/QuoteTable'
import AddQuoteModal from '../components/AddQuoteModal'
import CSVImportModal from '../components/CSVImportModal'

export default function RFQDetailPage() {
  const { id } = useParams()
  const { rfq, loading, error } = useRFQ(id)
  const { data: quotesData, loading: quotesLoading, error: quotesError, fetchQuotes, deleteQuote } = useQuotes(id)
  const [modalOpen, setModalOpen] = useState(false)
  const [csvModalOpen, setCsvModalOpen] = useState(false)

  if (loading) return <div className="page"><div className="loading">Loading RFQ…</div></div>
  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <Link to="/rfq" className="back-link">← Back to RFQs</Link>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/rfq" className="back-link">← RFQs</Link>
          <h1 style={{ marginTop: 4 }}>{rfq.item_name}</h1>
        </div>
      </div>

      <section className="section">
        <h2>RFQ Details</h2>
        <RFQSummaryCard rfq={rfq} />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Supplier Quotes</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm" onClick={() => setCsvModalOpen(true)}>
              ↑ Upload CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              + Add Quote
            </button>
          </div>
        </div>
        {quotesError && <div className="alert alert-error">{quotesError}</div>}
        {quotesLoading ? (
          <div className="loading">Loading quotes…</div>
        ) : (
          <QuoteTable
            quotes={quotesData?.quotes ?? []}
            onDelete={deleteQuote}
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
    </div>
  )
}
