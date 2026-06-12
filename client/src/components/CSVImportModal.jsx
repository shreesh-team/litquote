import { useEffect, useRef } from 'react'
import { useCSVImport } from '../hooks/useCSVImport'
import './CreateRFQModal.css'
import './CSVImportModal.css'

const SAMPLE_CSV =
  'supplier_name,unit_price,currency,lead_time_days,payment_terms,remarks\n' +
  'Acme Metals,12.75,USD,14,Net 30,Includes shipping\n' +
  'Global Steel,11.50,USD,21,Net 45,FOB origin\n' +
  'Pacific Supplies,13.20,USD,7,COD,Express delivery available\n'

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sample_quotes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CSVImportModal({ rfqId, onSuccess, onClose }) {
  const { importing, result, error, importCSV, reset } = useCSVImport()
  const fileInputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    await importCSV(rfqId, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange() { reset() }

  function handleClose() {
    if (result?.imported > 0) onSuccess()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
        <div className="modal-header">
          <div>
            <h2 id="csv-import-title">Import Quotes from CSV</h2>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="csv-file-row">
            <label className="csv-file-label" htmlFor="csv-file-input">CSV File</label>
            <div className="csv-file-input-wrap">
              <input
                id="csv-file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
                className="csv-file-input"
              />
            </div>
          </div>

          <div className="csv-format-hint">
            Required columns: <code>supplier_name</code>, <code>unit_price</code>, <code>currency</code>.
            Optional: <code>lead_time_days</code>, <code>payment_terms</code>, <code>remarks</code>.
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {result && (
            <div className={result.failed > 0 ? 'alert alert-warning' : 'alert alert-success'}>
              <strong>
                {result.imported} {result.imported === 1 ? 'quote' : 'quotes'} imported.
              </strong>
              {result.failed > 0 && ` ${result.failed} ${result.failed === 1 ? 'row' : 'rows'} failed.`}
            </div>
          )}

          {result?.errors?.length > 0 && (
            <div className="csv-error-table-wrap">
              <table className="csv-error-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <td>{e.row}</td>
                      <td>{e.column}</td>
                      <td><code>{e.value}</code></td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn csv-sample-btn" onClick={downloadSample}>
            ↓ Sample CSV
          </button>
          <button type="button" className="btn" onClick={handleClose} disabled={importing}>
            {result?.imported > 0 ? 'Done' : 'Cancel'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import Quotes'}
          </button>
        </div>
      </div>
    </div>
  )
}
