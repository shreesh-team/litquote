import { useState } from 'react'
import api from '../api/client'

export function useCSVImport() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function importCSV(rfqId, file) {
    setImporting(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post(`/rfq/${rfqId}/quotes/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data)
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Import failed. Please try again.'
      setError(detail)
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
  }

  return { importing, result, error, importCSV, reset }
}
