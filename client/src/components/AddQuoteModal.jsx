import { useEffect } from 'react'
import { useAddQuote } from '../hooks/useAddQuote'
import AddQuoteForm from './AddQuoteForm'
import './CreateRFQModal.css'

export default function AddQuoteModal({ rfqId, onSuccess, onClose }) {
  const handleSuccess = () => { onSuccess(); onClose() }
  const { addQuote, loading, error, fieldErrors } = useAddQuote(rfqId, handleSuccess)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="add-quote-title">
        <div className="modal-header">
          <h2 id="add-quote-title">Add Quote</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <AddQuoteForm
          onSubmit={addQuote}
          loading={loading}
          error={error}
          fieldErrors={fieldErrors}
        />
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
