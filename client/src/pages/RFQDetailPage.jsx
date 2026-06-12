import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useRFQ } from '../hooks/useRFQ'
import { useQuotes } from '../hooks/useQuotes'
import RFQSummaryCard from '../components/RFQSummaryCard'
import QuoteTable from '../components/QuoteTable'
import AddQuoteModal from '../components/AddQuoteModal'

export default function RFQDetailPage() {
  const { id } = useParams()
  const { rfq, loading, error } = useRFQ(id)
  const { data: quotesData, loading: quotesLoading, error: quotesError, fetchQuotes, deleteQuote } = useQuotes(id)
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <Link to="/rfq" className="back-link">← Back to RFQs</Link>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/rfq" className="back-link">← Back to RFQs</Link>
        <h1>{rfq.item_name}</h1>
      </div>

      <section className="section">
        <h2>RFQ Details</h2>
        <RFQSummaryCard rfq={rfq} />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Supplier Quotes</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
            + Add Quote
          </button>
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
    </div>
  )
}
