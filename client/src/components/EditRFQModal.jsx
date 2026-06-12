import { useState, useEffect } from 'react'
import { useEditRFQ } from '../hooks/useEditRFQ'
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

export default function EditRFQModal({ rfq, onClose, onSuccess }) {
  const { editRFQ, loading, error, fieldErrors } = useEditRFQ()
  const [fields, setFields] = useState({
    item_name: rfq.item_name ?? '',
    material_spec: rfq.material_spec ?? '',
    quantity: rfq.quantity != null ? String(rfq.quantity) : '',
    delivery_expectation: rfq.delivery_expectation ?? '',
    notes: rfq.notes ?? '',
  })
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate(fields)
    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors)
      setTouched({ item_name: true, quantity: true })
      return
    }
    const payload = {
      item_name: fields.item_name.trim(),
      material_spec: fields.material_spec || null,
      quantity: fields.quantity,
      delivery_expectation: fields.delivery_expectation || null,
      notes: fields.notes || null,
    }
    const updated = await editRFQ(rfq.id, payload)
    if (updated) onSuccess(updated)
  }

  const err = (name) => localErrors[name] || fieldErrors[name]

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-rfq-title">
        <div className="modal-header">
          <h2 id="edit-rfq-title">Edit RFQ</h2>
          <button type="button" className="modal-close" onClick={onClose} onMouseDown={e => e.preventDefault()} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <form id="edit-rfq-form" onSubmit={handleSubmit} noValidate>
            <div className={`form-group ${err('item_name') ? 'has-error' : ''}`}>
              <label htmlFor="edit-item_name">Item Name *</label>
              <input
                id="edit-item_name"
                name="item_name"
                value={fields.item_name}
                onChange={handleChange}
                onBlur={handleBlur}
                autoFocus
              />
              {err('item_name') && <span className="field-error">{err('item_name')}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="edit-material_spec">Material Spec</label>
              <textarea
                id="edit-material_spec"
                name="material_spec"
                value={fields.material_spec}
                onChange={handleChange}
                rows={2}
              />
            </div>

            <div className={`form-group ${err('quantity') ? 'has-error' : ''}`}>
              <label htmlFor="edit-quantity">Quantity *</label>
              <input
                id="edit-quantity"
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
              <label htmlFor="edit-delivery_expectation">Delivery Expectation</label>
              <input
                id="edit-delivery_expectation"
                name="delivery_expectation"
                type="date"
                value={fields.delivery_expectation}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-notes">Notes</label>
              <textarea
                id="edit-notes"
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
            form="edit-rfq-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
