import { useState } from 'react'

export default function RFQSummaryCard({ rfq }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="summary-card">
      <div className="summary-row">
        <span className="summary-label">Item Name</span>
        <span className="summary-value">{rfq.item_name}</span>
      </div>
      <div className="summary-row">
        <span className="summary-label">Quantity</span>
        <span className="summary-value">{rfq.quantity}</span>
      </div>
      {rfq.delivery_expectation && (
        <div className="summary-row">
          <span className="summary-label">Delivery Expectation</span>
          <span className="summary-value">{rfq.delivery_expectation}</span>
        </div>
      )}

      {!collapsed && (
        <>
          {rfq.material_spec && (
            <div className="summary-row">
              <span className="summary-label">Material Spec</span>
              <span className="summary-value">{rfq.material_spec}</span>
            </div>
          )}
          {rfq.notes && (
            <div className="summary-row">
              <span className="summary-label">Notes</span>
              <span className="summary-value">{rfq.notes}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-label">Quotes</span>
            <span className="summary-value">{rfq.quote_count}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Created</span>
            <span className="summary-value">{new Date(rfq.created_at).toLocaleDateString()}</span>
          </div>
        </>
      )}

      <button className="summary-toggle" onClick={() => setCollapsed(c => !c)}>
        {collapsed ? 'Show more ▾' : 'Show less ▴'}
      </button>
    </div>
  )
}
