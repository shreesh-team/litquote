import { useState } from 'react'
import client from '../api/client'

export function useVoidRFQ() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const voidRFQ = async (rfqId) => {
    setLoading(true)
    setError(null)
    try {
      const { data: rfq } = await client.post(`/rfq/${rfqId}/void`)
      return rfq
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to void RFQ.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { voidRFQ, loading, error }
}
