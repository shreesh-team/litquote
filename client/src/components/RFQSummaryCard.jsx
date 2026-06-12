function MetaItem({ label, value, truncate, grow }) {
  if (!value && value !== 0) return null
  return (
    <div className={`rfq-meta-item${grow ? ' rfq-meta-item--grow' : ''}`}>
      <span className="rfq-meta-label">{label}</span>
      <span
        className={`rfq-meta-value${truncate ? ' rfq-meta-value--truncate' : ''}`}
        data-tooltip={truncate ? String(value) : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export default function RFQSummaryCard({ rfq }) {
  const created = new Date(rfq.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div className="rfq-meta-strip">
      <MetaItem label="Quantity" value={rfq.quantity} />
      <MetaItem
        label="Delivery By"
        value={rfq.delivery_expectation ?? <span className="rfq-meta-value--muted">—</span>}
      />
      <MetaItem label="Material Spec" value={rfq.material_spec} truncate grow />
      <MetaItem label="Notes" value={rfq.notes} truncate grow />
      <MetaItem label="Created" value={created} />
    </div>
  )
}
