import { useParams, Link } from 'react-router'
import { useRFQ } from '../hooks/useRFQ'
import RFQSummaryCard from '../components/RFQSummaryCard'

export default function RFQDetailPage() {
  const { id } = useParams()
  const { rfq, loading, error } = useRFQ(id)

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
        <h2>Supplier Quotes</h2>
        {/* Quote comparison table — coming in Feature 02 */}
        <p className="text-muted">No quotes yet. Quote management coming soon.</p>
      </section>
    </div>
  )
}
