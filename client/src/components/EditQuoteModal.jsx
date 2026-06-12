import { useEffect } from 'react'
import { useEditQuote } from '../hooks/useEditQuote'
import AddQuoteForm from './AddQuoteForm'
import './CreateRFQModal.css'

export default function EditQuoteModal({ quote, onSuccess, onClose }) {
  const handleSuccess = () => { onSuccess(); onClose() }
  const { editQuote, loading, error, fieldErrors } = useEditQuote(handleSuccess)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const initialValues = {
    supplier_name: quote.supplier_name ?? '',
    unit_price: quote.unit_price != null ? String(quote.unit_price) : '',
    currency: quote.currency ?? 'USD',
    lead_time_days: quote.lead_time_days != null ? String(quote.lead_time_days) : '',
    payment_terms: quote.payment_terms ?? '',
    remarks: quote.remarks ?? '',
  }

  const handleSubmit = (formData) => editQuote(quote.id, formData)

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="edit-quote-title">
        <div className="modal-header">
          <h2 id="edit-quote-title">Edit Quote</h2>
          <div className="modal-header-meta">{quote.supplier_name}</div>
          <button type="button" className="modal-close" onClick={onClose} onMouseDown={e => e.preventDefault()} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <AddQuoteForm
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            fieldErrors={fieldErrors}
            initialValues={initialValues}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} onMouseDown={e => e.preventDefault()} disabled={loading}>
            Cancel
          </button>
          <button type="submit" form="add-quote-form" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
