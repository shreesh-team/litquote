import { useState } from 'react'
import client from '../api/client'

export function useAwardQuote() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const awardQuote = async (rfqId, quoteId) => {
    setLoading(true)
    setError(null)
    try {
      const { data: rfq } = await client.post(`/rfq/${rfqId}/award`, { quote_id: quoteId })
      return rfq
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to award quote.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { awardQuote, loading, error }
}
