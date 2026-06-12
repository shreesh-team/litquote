import { useState, useEffect } from 'react'
import { useCreateRFQ } from '../hooks/useCreateRFQ'
import './CreateRFQModal.css'

function validate(fields) {
  const errors = {}
  if (!fields.item_name.trim()) errors.item_name = 'Item name is required.'
  const qty = parseFloat(fields.quantity)
  if (!fields.quantity || isNaN(qty) || qty <= 0) {
    errors.quantity = 'Quantity must be a positive number.'
  }
  return errors
}

const EMPTY = {
  item_name: '',
  material_spec: '',
  quantity: '',
  delivery_expectation: '',
  notes: '',
}

export default function CreateRFQModal({ onClose }) {
  const { createRFQ, loading, error, fieldErrors } = useCreateRFQ()
  const [fields, setFields] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [localErrors, setLocalErrors] = useState({})

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBlur = (e) => {
    const name = e.target.name
    setTouched((t) => ({ ...t, [name]: true }))
    setLocalErrors(validate({ ...fields }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFields((f) => ({ ...f, [name]: value }))
    if (touched[name]) setLocalErrors(validate({ ...fields, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errors = validate(fields)
    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors)
      setTouched({ item_name: true, quantity: true })
      return
    }
    createRFQ({
      item_name: fields.item_name.trim(),
      material_spec: fields.material_spec || null,
      quantity: fields.quantity,
      delivery_expectation: fields.delivery_expectation || null,
      notes: fields.notes || null,
    })
  }

  const err = (name) => localErrors[name] || fieldErrors[name]

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">Create RFQ</h2>
          <button type="button" className="modal-close" onClick={onClose} onMouseDown={e => e.preventDefault()} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
        {error && <div className="alert alert-error">{error}</div>}

        <form id="create-rfq-form" onSubmit={handleSubmit} noValidate>
          <div className={`form-group ${err('item_name') ? 'has-error' : ''}`}>
            <label htmlFor="item_name">Item Name *</label>
            <input
              id="item_name"
              name="item_name"
              value={fields.item_name}
              onChange={handleChange}
              onBlur={handleBlur}
              autoFocus
            />
            {err('item_name') && <span className="field-error">{err('item_name')}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="material_spec">Material Spec</label>
            <textarea
              id="material_spec"
              name="material_spec"
              value={fields.material_spec}
              onChange={handleChange}
              rows={2}
            />
          </div>

          <div className={`form-group ${err('quantity') ? 'has-error' : ''}`}>
            <label htmlFor="quantity">Quantity *</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0.0001"
              value={fields.quantity}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {err('quantity') && <span className="field-error">{err('quantity')}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="delivery_expectation">Delivery Expectation</label>
            <input
              id="delivery_expectation"
              name="delivery_expectation"
              type="date"
              value={fields.delivery_expectation}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={fields.notes}
              onChange={handleChange}
              rows={2}
            />
          </div>

        </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} onMouseDown={e => e.preventDefault()} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-rfq-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create RFQ'}
          </button>
        </div>
      </div>
    </div>
  )
}
