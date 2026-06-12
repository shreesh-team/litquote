import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'

export function useQuotes(rfqId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchQuotes = useCallback(async () => {
    if (!rfqId) return
    setLoading(true)
    setError(null)
    try {
      const { data: result } = await client.get(`/rfq/${rfqId}/quotes`)
      setData(result)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('RFQ not found.')
      } else {
        setError('Failed to load quotes.')
      }
    } finally {
      setLoading(false)
    }
  }, [rfqId])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])

  const deleteQuote = async (quoteId) => {
    try {
      await client.delete(`/quote/${quoteId}`)
    } catch (err) {
      if (err.response?.status !== 404) {
        throw err
      }
    } finally {
      await fetchQuotes()
    }
  }

  return { data, loading, error, fetchQuotes, deleteQuote }
}
