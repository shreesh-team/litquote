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
    <form id="add-quote-form" className="aq-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Supplier — full width */}
      <div className={`form-group aq-full${fieldError('supplier_name') ? ' has-error' : ''}`}>
        <label htmlFor="aq-supplier">Supplier Name <span className="aq-required">*</span></label>
        <input
          id="aq-supplier"
          type="text"
          value={fields.supplier_name}
          onChange={(e) => set('supplier_name', e.target.value)}
          onBlur={() => handleBlur('supplier_name')}
          placeholder="e.g. Acme Metals Ltd."
          maxLength={255}
          autoFocus
        />
        {fieldError('supplier_name') && <span className="field-error">{allFieldErrors.supplier_name}</span>}
      </div>

      {/* Unit price + Currency — paired in one row */}
      <div className="aq-row">
        <div className={`form-group aq-price${fieldError('unit_price') ? ' has-error' : ''}`}>
          <label htmlFor="aq-price">Unit Price <span className="aq-required">*</span></label>
          <div className="aq-input-group">
            <input
              id="aq-price"
              type="number"
              min="0"
              step="any"
              value={fields.unit_price}
              onChange={(e) => set('unit_price', e.target.value)}
              onBlur={() => handleBlur('unit_price')}
              placeholder="0.00"
            />
            <input
              id="aq-currency"
              type="text"
              className={`aq-currency-input${fieldError('currency') ? ' has-error' : ''}`}
              value={fields.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
              onBlur={() => handleBlur('currency')}
              maxLength={3}
              placeholder="USD"
              aria-label="Currency"
            />
          </div>
          {fieldError('unit_price') && <span className="field-error">{allFieldErrors.unit_price}</span>}
          {!fieldError('unit_price') && fieldError('currency') && <span className="field-error">{allFieldErrors.currency}</span>}
        </div>

        {/* Lead time + Payment terms — paired in one row */}
        <div className={`form-group${fieldError('lead_time_days') ? ' has-error' : ''}`}>
          <label htmlFor="aq-lead">Lead Time (days)</label>
          <input
            id="aq-lead"
            type="number"
            min="0"
            step="1"
            value={fields.lead_time_days}
            onChange={(e) => set('lead_time_days', e.target.value)}
            onBlur={() => handleBlur('lead_time_days')}
            placeholder="e.g. 14"
          />
          {fieldError('lead_time_days') && <span className="field-error">{allFieldErrors.lead_time_days}</span>}
        </div>
      </div>

      {/* Payment terms — full width */}
      <div className="form-group aq-full">
        <label htmlFor="aq-terms">Payment Terms</label>
        <input
          id="aq-terms"
          type="text"
          value={fields.payment_terms}
          onChange={(e) => set('payment_terms', e.target.value)}
          placeholder="e.g. Net 30, COD, Letter of Credit"
          maxLength={255}
        />
      </div>

      {/* Remarks — full width */}
      <div className="form-group aq-full" style={{ marginBottom: 0 }}>
        <label htmlFor="aq-remarks">Remarks</label>
        <textarea
          id="aq-remarks"
          value={fields.remarks}
          onChange={(e) => set('remarks', e.target.value)}
          placeholder="Any additional notes, conditions, or observations…"
          rows={3}
        />
      </div>
    </form>
  )
}
