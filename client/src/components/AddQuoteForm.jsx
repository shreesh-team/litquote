import { useState } from 'react'
import './AddQuoteForm.css'

const DEFAULTS = {
  supplier_name: '',
  unit_price: '',
  currency: 'USD',
  lead_time_days: '',
  payment_terms: '',
  remarks: '',
}

function validate(fields) {
  const errors = {}
  if (!fields.supplier_name.trim()) {
    errors.supplier_name = 'Supplier name is required.'
  }
  if (fields.unit_price === '' || fields.unit_price === null) {
    errors.unit_price = 'Unit price is required.'
  } else if (isNaN(Number(fields.unit_price)) || Number(fields.unit_price) < 0) {
    errors.unit_price = 'Unit price must be a number ≥ 0.'
  }
  if (fields.currency && !/^[A-Za-z]{3}$/.test(fields.currency)) {
    errors.currency = 'Currency must be exactly 3 letters.'
  }
  if (fields.lead_time_days !== '' && fields.lead_time_days !== null) {
    const n = Number(fields.lead_time_days)
    if (!Number.isInteger(n) || n < 0) {
      errors.lead_time_days = 'Lead time must be a non-negative whole number.'
    }
  }
  return errors
}

export default function AddQuoteForm({ onSubmit, loading, error, fieldErrors }) {
  const [fields, setFields] = useState(DEFAULTS)
  const [touched, setTouched] = useState({})
  const [localErrors, setLocalErrors] = useState({})

  const allFieldErrors = { ...localErrors, ...fieldErrors }

  const set = (name, value) => setFields((f) => ({ ...f, [name]: value }))

  const handleBlur = (name) => {
    setTouched((t) => ({ ...t, [name]: true }))
    setLocalErrors(validate(fields))
  }

  const handleCurrencyChange = (e) => {
    set('currency', e.target.value.toUpperCase())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate(fields)
    setLocalErrors(errors)
    setTouched({ supplier_name: true, unit_price: true, currency: true, lead_time_days: true })
    if (Object.keys(errors).length > 0) return

    const payload = {
      supplier_name: fields.supplier_name.trim(),
      unit_price: fields.unit_price,
      currency: fields.currency || 'USD',
    }
    if (fields.lead_time_days !== '') payload.lead_time_days = Number(fields.lead_time_days)
    if (fields.payment_terms.trim()) payload.payment_terms = fields.payment_terms.trim()
    if (fields.remarks.trim()) payload.remarks = fields.remarks.trim()

    const ok = await onSubmit(payload)
    if (ok) {
      setFields(DEFAULTS)
      setTouched({})
      setLocalErrors({})
    }
  }

  const fieldError = (name) => touched[name] && allFieldErrors[name]

  return (
    <form className="add-quote-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-row">
        <div className={`form-group${fieldError('supplier_name') ? ' has-error' : ''}`}>
          <label htmlFor="aq-supplier">Supplier Name *</label>
          <input
            id="aq-supplier"
            type="text"
            value={fields.supplier_name}
            onChange={(e) => set('supplier_name', e.target.value)}
            onBlur={() => handleBlur('supplier_name')}
            maxLength={255}
          />
          {fieldError('supplier_name') && (
            <span className="field-error">{allFieldErrors.supplier_name}</span>
          )}
        </div>

        <div className={`form-group${fieldError('unit_price') ? ' has-error' : ''}`}>
          <label htmlFor="aq-price">Unit Price *</label>
          <input
            id="aq-price"
            type="number"
            min="0"
            step="any"
            value={fields.unit_price}
            onChange={(e) => set('unit_price', e.target.value)}
            onBlur={() => handleBlur('unit_price')}
          />
          {fieldError('unit_price') && (
            <span className="field-error">{allFieldErrors.unit_price}</span>
          )}
        </div>

        <div className={`form-group form-group--sm${fieldError('currency') ? ' has-error' : ''}`}>
          <label htmlFor="aq-currency">Currency</label>
          <input
            id="aq-currency"
            type="text"
            value={fields.currency}
            onChange={handleCurrencyChange}
            onBlur={() => handleBlur('currency')}
            maxLength={3}
            placeholder="USD"
          />
          {fieldError('currency') && (
            <span className="field-error">{allFieldErrors.currency}</span>
          )}
        </div>

        <div className={`form-group form-group--sm${fieldError('lead_time_days') ? ' has-error' : ''}`}>
          <label htmlFor="aq-lead">Lead Time (days)</label>
          <input
            id="aq-lead"
            type="number"
            min="0"
            step="1"
            value={fields.lead_time_days}
            onChange={(e) => set('lead_time_days', e.target.value)}
            onBlur={() => handleBlur('lead_time_days')}
          />
          {fieldError('lead_time_days') && (
            <span className="field-error">{allFieldErrors.lead_time_days}</span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="aq-terms">Payment Terms</label>
          <input
            id="aq-terms"
            type="text"
            value={fields.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
            maxLength={255}
          />
        </div>

        <div className="form-group form-group--wide">
          <label htmlFor="aq-remarks">Remarks</label>
          <textarea
            id="aq-remarks"
            value={fields.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Adding…' : 'Add Quote'}
        </button>
      </div>
    </form>
  )
}
